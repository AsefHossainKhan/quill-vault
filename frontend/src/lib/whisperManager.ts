/**
 * Singleton Whisper manager — one worker, one model load, shared across the app.
 *
 * The worker and loaded model survive component unmounts (navigation).
 * Call `ensureModel()` early (e.g. app boot) so it's ready when the user
 * starts recording.
 */

import type { WhisperModelId } from './whisper'
import type { TranscriptSegment } from '../stores/transcriptionStore'

// ── Types ────────────────────────────────────────────────────────────
export interface WhisperProgress {
  progress: number
  stage: string | null
}

export interface WhisperResult {
  segments: TranscriptSegment[]
  detectedLanguage: string
  duration: number
}

type ProgressCallback = (p: WhisperProgress) => void

// ── Singleton state ──────────────────────────────────────────────────
let worker: Worker | null = null
let loadedModel: string | null = null
let loadingPromise: Promise<void> | null = null

// ── Internal helpers ─────────────────────────────────────────────────
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./whisperWorker.ts', import.meta.url),
      { type: 'module' },
    )
    // If the worker dies unexpectedly, reset state so a new one is created
    worker.onerror = () => {
      worker = null
      loadedModel = null
      loadingPromise = null
    }
  }
  return worker
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Ensure the model is loaded and ready. Safe to call multiple times —
 * subsequent calls are no-ops if the model is already loaded.
 *
 * Pass `onProgress` to receive loading updates (progress %, stage text).
 */
export async function ensureModel(
  model: WhisperModelId,
  onProgress?: ProgressCallback,
): Promise<void> {
  // Already loaded
  if (loadedModel === model) return

  // Currently loading — piggyback on the existing promise
  if (loadingPromise) {
    // Note: piggybacking callers won't get individual progress events,
    // but they'll resolve once loading finishes
    return loadingPromise
  }

  loadingPromise = (async () => {
    const w = getWorker()

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        w.removeEventListener('message', handler)
        loadingPromise = null
        reject(new Error('Model load timed out'))
      }, 120_000)

      const handler = (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === 'progress') {
          onProgress?.({ progress: msg.progress, stage: msg.stage ?? null })
        } else if (msg.type === 'result') {
          clearTimeout(timeout)
          w.removeEventListener('message', handler)
          loadedModel = model
          loadingPromise = null
          onProgress?.({ progress: 100, stage: 'Model ready' })
          resolve()
        } else if (msg.type === 'error') {
          clearTimeout(timeout)
          w.removeEventListener('message', handler)
          loadingPromise = null
          reject(new Error(msg.error))
        }
      }

      w.addEventListener('message', handler)

      // Warmup: 1 second of silence triggers model load + inference
      const warmup = new Float32Array(16000)
      w.postMessage({
        type: 'start',
        audio: warmup,
        model,
        language: 'en',
        baseUrl: window.location.origin,
      })
    })
  })()

  return loadingPromise
}

/**
 * Check whether a model is currently loaded and ready.
 */
export function isModelReady(model: WhisperModelId): boolean {
  return loadedModel === model
}

/**
 * Transcribe an audio buffer. Model must be loaded first via `ensureModel()`.
 */
export function transcribe(
  audio: Float32Array,
  model: WhisperModelId,
  language: string,
  onProgress?: ProgressCallback,
): Promise<WhisperResult> {
  const w = getWorker()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      w.removeEventListener('message', handler)
      reject(new Error('Transcription timed out'))
    }, 300_000)

    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.({ progress: msg.progress, stage: msg.stage ?? null })
      } else if (msg.type === 'result') {
        clearTimeout(timeout)
        w.removeEventListener('message', handler)
        resolve({
          segments: (msg.segments || []).map((s: { start: number; end: number; text: string }) => ({
            start: s.start,
            end: s.end,
            text: s.text,
          })),
          detectedLanguage: msg.language || language,
          duration: msg.duration,
        })
      } else if (msg.type === 'error') {
        clearTimeout(timeout)
        w.removeEventListener('message', handler)
        reject(new Error(msg.error))
      }
    }

    w.addEventListener('message', handler)
    w.postMessage({
      type: 'start',
      audio,
      model,
      language,
      baseUrl: window.location.origin,
    })
  })
}
