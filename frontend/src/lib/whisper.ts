/**
 * Whisper transcription helpers.
 *
 * - decodeAudioBlob: Convert a WebM/Opus Blob to Float32Array (16kHz mono PCM)
 * - createWhisperWorker: Spawn the Web Worker for local transcription
 * - TRANSCRIPTION_WHISPER_MODELS: Available model sizes with metadata
 */

export const TRANSCRIPTION_WHISPER_MODELS = [
  { id: 'tiny' as const, label: 'Tiny', size: '~145 MB', speed: 'Fastest', accuracy: 'Basic', desc: 'Bundled — fast, lower accuracy' },
  // Future models can be added here (must be bundled in public/models/)
] as const

export type WhisperModelId = (typeof TRANSCRIPTION_WHISPER_MODELS)[number]['id']

/**
 * Decode a Blob (e.g. audio/webm) into a Float32Array at 16kHz mono,
 * suitable for Whisper input.
 */
export async function decodeAudioBlob(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  // Mix down to mono if stereo
  let mono: Float32Array
  if (audioBuffer.numberOfChannels === 1) {
    mono = audioBuffer.getChannelData(0)
  } else {
    const left = audioBuffer.getChannelData(0)
    const right = audioBuffer.getChannelData(1)
    mono = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2
    }
  }

  await audioContext.close()
  return mono
}

/**
 * Merge two mono PCM Float32Arrays (e.g. mic + system audio).
 * Pads the shorter buffer with silence, then averages the amplitudes.
 * Both buffers must be at the same sample rate (16kHz).
 */
export function mergeAudioBuffers(a: Float32Array, b: Float32Array): Float32Array {
  const length = Math.max(a.length, b.length)
  const merged = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const sampleA = i < a.length ? a[i] : 0
    const sampleB = i < b.length ? b[i] : 0
    merged[i] = (sampleA + sampleB) / 2
  }
  return merged
}

/**
 * Decode multiple audio Blobs and merge them into a single mono PCM buffer.
 * Useful for combining mic + system audio recordings.
 */
export async function decodeAndMergeAudioBlobs(blobs: Blob[]): Promise<Float32Array> {
  const buffers = await Promise.all(
    blobs.filter((b) => b.size > 0).map((b) => decodeAudioBlob(b)),
  )
  if (buffers.length === 0) return new Float32Array(0)
  if (buffers.length === 1) return buffers[0]
  return buffers.reduce((acc, buf) => mergeAudioBuffers(acc, buf))
}

export interface WhisperWorkerResult {
  type: 'result'
  segments: Array<{ start: number; end: number; text: string }>
  language: string
  duration: number
}

export interface WhisperWorkerProgress {
  type: 'progress'
  progress: number
  stage?: string
}

export interface WhisperWorkerError {
  type: 'error'
  error: string
}

export type WhisperWorkerMessage =
  | WhisperWorkerResult
  | WhisperWorkerProgress
  | WhisperWorkerError

/**
 * Transcribe audio using the Web Worker.
 * Returns a promise that resolves with the transcription result.
 */
export function transcribeInWorker(
  worker: Worker,
  audio: Float32Array,
  model: string,
  language: string,
  onProgress: (progress: number, stage?: string) => void,
): Promise<WhisperWorkerResult> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<WhisperWorkerMessage>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress(msg.progress, msg.stage)
      } else if (msg.type === 'result') {
        worker.removeEventListener('message', handler)
        resolve(msg)
      } else if (msg.type === 'error') {
        worker.removeEventListener('message', handler)
        reject(new Error(msg.error))
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage({ type: 'start', audio, model, language, baseUrl: window.location.origin })
  })
}
