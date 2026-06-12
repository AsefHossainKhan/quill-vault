/**
 * Web Worker for client-side Whisper transcription using @huggingface/transformers.
 *
 * Models are bundled locally in public/models/ — no internet required.
 * ONNX Runtime WASM binaries are bundled in public/wasm/ — no CDN needed.
 *
 * Messages:
 *   Main → Worker:  { type: 'start', audio, model, language, baseUrl? }
 *   Worker → Main:  { type: 'progress', progress: number, stage: string }
 *   Worker → Main:  { type: 'result',   segments, language, duration }
 *   Worker → Main:  { type: 'error',    error: string }
 */

// ── 0. Patch globalThis.fetch BEFORE importing transformers ──────────
//    onnxruntime-web uses globalThis.fetch internally.  In Vite dev mode
//    workers run from blob: URLs, so relative fetch() fails.  We intercept
//    and redirect to the real server origin.  CDN WASM URLs are also caught
//    and redirected to local bundled files.
let _serverOrigin = ''

const _originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (typeof input === 'string') {
    if (input.startsWith('/') && _serverOrigin) {
      input = `${_serverOrigin}${input}`
    }
    if (input.includes('cdn.jsdelivr.net') && input.includes('onnxruntime-web')) {
      const suffix = input.endsWith('.wasm') ? '.wasm' : input.endsWith('.mjs') ? '.mjs' : ''
      if (suffix) {
        return _originalFetch(`${_serverOrigin}/wasm/ort-wasm-simd-threaded.asyncify${suffix}`, init)
      }
    }
  }
  return _originalFetch(input as string, init)
}

// ── 1. Import transformers (triggers ORT module init) ────────────────
import { pipeline, env } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = true
env.allowRemoteModels = false

// Patch env.fetch so transformers.js hub code resolves relative paths
const _originalEnvFetch = env.fetch
env.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/') && _serverOrigin) {
    input = `${_serverOrigin}${input}`
  }
  return _originalEnvFetch(input as string, init)
}

// ── 2. Configure ORT WASM backend (runs after first message) ────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ORT env types are not exported
type OrtEnv = Record<string, any>

function configureWasm(origin: string) {
  const ort = (env as OrtEnv).backends?.onnx
  if (!ort?.wasm) return
  env.useWasmCache = false
  // Use all available CPU threads — Electron injects COOP/COEP headers for cross-origin isolation
  ort.wasm.numThreads = typeof navigator !== 'undefined'
    ? (navigator.hardwareConcurrency || 4)
    : 4
  ort.wasm.proxy = false
  ort.wasm.wasmPaths = {
    mjs: `${origin}/wasm/ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${origin}/wasm/ort-wasm-simd-threaded.asyncify.wasm`,
  }
}

async function loadLocalWasm(origin: string) {
  const ort = (env as OrtEnv).backends?.onnx
  if (!ort?.wasm || ort.wasm.wasmBinary) return
  const response = await fetch(`${origin}/wasm/ort-wasm-simd-threaded.asyncify.wasm`)
  if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`)
  ort.wasm.wasmBinary = await response.arrayBuffer()
}

// ── 3. Worker message handler ────────────────────────────────────────
let transcriber: AutomaticSpeechRecognitionPipeline | null = null
let currentModel = ''
let initTimer: ReturnType<typeof setTimeout> | null = null
let envConfigured = false

interface StartMessage {
  type: 'start'
  audio: Float32Array
  model: string
  language: string
  baseUrl?: string
}

self.onmessage = async (e: MessageEvent<StartMessage>) => {
  const { type } = e.data
  if (type !== 'start') return

  const { audio, model, language, baseUrl } = e.data

  if (baseUrl && !envConfigured) {
    _serverOrigin = baseUrl
    envConfigured = true
    configureWasm(baseUrl)
  }

  try {
    if (!transcriber || currentModel !== model) {
      self.postMessage({ type: 'progress', progress: 0, stage: `Loading ${model} model…` })

      await loadLocalWasm(_serverOrigin)

      transcriber = (await pipeline(
        'automatic-speech-recognition',
        `/models/whisper-${model}`,
        {
          local_files_only: true,
          dtype: 'fp32', // Bundled models are fp32, not quantized
          progress_callback: (data: Record<string, unknown>) => {
            if (data.status === 'progress' && typeof data.loaded === 'number' && typeof data.total === 'number' && data.total > 0) {
              const pct = Math.round((data.loaded / data.total) * 100)
              const file = typeof data.file === 'string' ? data.file.split('/').pop() : ''
              self.postMessage({ type: 'progress', progress: Math.min(pct, 99), stage: `Loading ${file}…` })
              if (pct >= 99) {
                if (initTimer) clearTimeout(initTimer)
                initTimer = setTimeout(() => {
                  self.postMessage({ type: 'progress', progress: 99, stage: 'Compiling ONNX model (CPU)…' })
                }, 300)
              }
            } else if (data.status === 'initiate') {
              if (initTimer) clearTimeout(initTimer)
              const file = typeof data.file === 'string' ? data.file.split('/').pop() : ''
              self.postMessage({ type: 'progress', progress: 0, stage: `Loading ${file}…` })
            }
          },
        },
      )) as AutomaticSpeechRecognitionPipeline

      currentModel = model
      self.postMessage({ type: 'progress', progress: 100, stage: 'Model loaded — transcribing…' })
    } else {
      self.postMessage({ type: 'progress', progress: 5, stage: 'Transcribing…' })
    }

    // Estimate audio duration for progress reporting
    const audioDurationSec = audio.length / 16000
    self.postMessage({
      type: 'progress',
      progress: 10,
      stage: `Transcribing ${Math.round(audioDurationSec)}s of audio…`,
    })

    // Run transcription
    const output = await transcriber(audio, {
      language: language || undefined,
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    })

    // Normalize output into our segment format
    self.postMessage({ type: 'progress', progress: 90, stage: 'Formatting results…' })
    const segments: Array<{ start: number; end: number; text: string }> = []
    const duration = audio.length / 16000 // 16kHz sample rate

    if (output.chunks && Array.isArray(output.chunks)) {
      for (const chunk of output.chunks) {
        if (chunk.timestamp) {
          segments.push({
            start: chunk.timestamp[0] ?? 0,
            end: chunk.timestamp[1] ?? 0,
            text: (chunk.text as string).trim(),
          })
        }
      }
    } else {
      segments.push({
        start: 0,
        end: duration,
        text: (output.text as string).trim(),
      })
    }

    self.postMessage({
      type: 'result',
      segments,
      language: language || 'unknown',
      duration,
    })
  } catch (err) {
    let errorMessage = err instanceof Error ? err.message : String(err)

    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      errorMessage =
        'Failed to load the bundled model. ' +
        'The model files may be missing from the public/models/ directory.'
    } else if (errorMessage.includes('OutOfMemory') || errorMessage.includes('memory') || errorMessage.includes('allocate a buffer')) {
      errorMessage =
        'Not enough memory to load this model. ' +
        'Try switching to the Tiny model — it uses less RAM.'
    }

    self.postMessage({
      type: 'error',
      error: errorMessage,
    })
  }
}
