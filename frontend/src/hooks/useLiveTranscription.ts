import { useRef, useCallback } from 'react'
import { useTranscriptionStore, type TranscriptSegment } from '../stores/transcriptionStore'
import { ensureModel, transcribe, isModelReady } from '../lib/whisperManager'
import type { WhisperModelId } from '../lib/whisper'

/**
 * Live transcription hook.
 *
 * Uses the global whisperManager singleton (model loads once, survives navigation).
 * Taps into mic AND system audio MediaStreams via ScriptProcessorNode to accumulate
 * raw PCM samples. Every `INTERVAL_MS` sends accumulated audio (mic+system mixed)
 * for transcription.
 */
export function useLiveTranscription() {
  // Mic samples
  const micSamplesRef = useRef<Float32Array[]>([])
  const micTotalSamplesRef = useRef(0)
  const micScriptNodeRef = useRef<ScriptProcessorNode | null>(null)

  // System audio samples
  const sysSamplesRef = useRef<Float32Array[]>([])
  const sysTotalSamplesRef = useRef(0)
  const sysScriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const sysAudioCtxRef = useRef<AudioContext | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micAudioCtxRef = useRef<AudioContext | null>(null)
  const isTranscribingRef = useRef(false)
  const languageRef = useRef<string>('')

  const {
    setSegments,
    setIsTranscribing,
    setProgress,
    setStage,
    setError,
    setDetectedLanguage,
    setModelReady,
    setQueueCount,
    setIsStopping,
    reset,
  } = useTranscriptionStore.getState()

  const INTERVAL_MS = 4000
  const BUFFER_SIZE = 4096

  /** Merge an array of Float32Array chunks into a single contiguous buffer. */
  const mergeChunks = useCallback((chunks: Float32Array[], total: number): Float32Array => {
    if (total === 0 || chunks.length === 0) return new Float32Array(0)
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return merged
  }, [])

  /** Pre-load the model without starting recording. */
  const preloadModel = useCallback(async (model: WhisperModelId) => {
    if (isModelReady(model)) {
      setModelReady(true)
      return
    }
    setStage('Loading Whisper model…')
    setProgress(0)
    try {
      await ensureModel(model, ({ progress, stage }) => {
        setProgress(progress)
        if (stage) setStage(stage)
      })
      setModelReady(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [setStage, setProgress, setError, setModelReady])

  /** Discard current recording and clean up audio resources. */
  const discardLive = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Mic cleanup
    if (micScriptNodeRef.current) {
      micScriptNodeRef.current.disconnect()
      micScriptNodeRef.current = null
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
      micAudioCtxRef.current.close()
      micAudioCtxRef.current = null
    }
    // System audio cleanup
    if (sysScriptNodeRef.current) {
      sysScriptNodeRef.current.disconnect()
      sysScriptNodeRef.current = null
    }
    if (sysAudioCtxRef.current && sysAudioCtxRef.current.state !== 'closed') {
      sysAudioCtxRef.current.close()
      sysAudioCtxRef.current = null
    }
    micSamplesRef.current = []
    micTotalSamplesRef.current = 0
    sysSamplesRef.current = []
    sysTotalSamplesRef.current = 0
    isTranscribingRef.current = false
    reset()
  }, [reset])

  /** Start live transcription from mic and (optionally) system audio MediaStreams. */
  const startLive = useCallback(async (
    micStream: MediaStream,
    model: WhisperModelId,
    language: string,
    systemStream?: MediaStream | null,
  ) => {
    // Reset state
    micSamplesRef.current = []
    micTotalSamplesRef.current = 0
    sysSamplesRef.current = []
    sysTotalSamplesRef.current = 0
    languageRef.current = language
    isTranscribingRef.current = false
    reset()
    setIsTranscribing(true)
    setStage('Loading Whisper model…')

    try {
      // Ensure model is loaded (singleton — no-op if already loaded)
      await ensureModel(model, ({ progress, stage }) => {
        setProgress(progress)
        if (stage) setStage(stage)
      })
      setModelReady(true)
      setProgress(0)
      setStage(null)

      // --- Tap into mic stream ---
      const micCtx = new AudioContext({ sampleRate: 16000 })
      micAudioCtxRef.current = micCtx
      const micSource = micCtx.createMediaStreamSource(micStream)
      const micScript = micCtx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      micScriptNodeRef.current = micScript

      micScript.onaudioprocess = (e) => {
        if (micCtx.state === 'closed') return
        const inputData = e.inputBuffer.getChannelData(0)
        const copy = new Float32Array(inputData.length)
        copy.set(inputData)
        micSamplesRef.current.push(copy)
        micTotalSamplesRef.current += copy.length
      }

      micSource.connect(micScript)
      micScript.connect(micCtx.destination)

      // --- Tap into system audio stream (if available) ---
      if (systemStream) {
        const sysCtx = new AudioContext({ sampleRate: 16000 })
        sysAudioCtxRef.current = sysCtx
        const sysSource = sysCtx.createMediaStreamSource(systemStream)
        const sysScript = sysCtx.createScriptProcessor(BUFFER_SIZE, 1, 1)
        sysScriptNodeRef.current = sysScript

        sysScript.onaudioprocess = (e) => {
          if (sysCtx.state === 'closed') return
          const inputData = e.inputBuffer.getChannelData(0)
          const copy = new Float32Array(inputData.length)
          copy.set(inputData)
          sysSamplesRef.current.push(copy)
          sysTotalSamplesRef.current += copy.length
        }

        sysSource.connect(sysScript)
        sysScript.connect(sysCtx.destination)
      }

      setStage('Listening… speak now')

      // Helper: merge mic + system samples into a single buffer
      const mergeSamples = (): Float32Array => {
        const micMerged = mergeChunks(micSamplesRef.current, micTotalSamplesRef.current)
        const sysMerged = mergeChunks(sysSamplesRef.current, sysTotalSamplesRef.current)

        if (sysMerged.length === 0) return micMerged
        if (micMerged.length === 0) return sysMerged

        // Pad shorter to match longer, then average
        const length = Math.max(micMerged.length, sysMerged.length)
        const mixed = new Float32Array(length)
        for (let i = 0; i < length; i++) {
          const a = i < micMerged.length ? micMerged[i] : 0
          const b = i < sysMerged.length ? sysMerged[i] : 0
          mixed[i] = (a + b) / 2
        }
        return mixed
      }

      // Periodically transcribe accumulated audio (mic + system mixed)
      intervalRef.current = setInterval(async () => {
        if (isTranscribingRef.current) return
        const totalSamples = micTotalSamplesRef.current + sysTotalSamplesRef.current
        if (totalSamples < 16000) return

        isTranscribingRef.current = true
        // Track queue: we have 1 chunk being processed now
        setQueueCount(1)

        try {
          const merged = mergeSamples()

          setStage('Transcribing…')
          setProgress(-1)

          const result = await transcribe(merged, model, languageRef.current, ({ progress, stage }) => {
            if (progress >= 0) setProgress(progress)
            if (stage) setStage(stage)
          })

          if (result.segments.length > 0) {
            setSegments(result.segments)
            setDetectedLanguage(result.detectedLanguage)
          }

          setStage('Listening…')
          setProgress(0)
          setQueueCount(0)
        } catch (err) {
          console.error('Live transcription error:', err)
          setQueueCount(0)
        } finally {
          isTranscribingRef.current = false
        }
      }, INTERVAL_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsTranscribing(false)
    }
  }, [mergeChunks, reset, setIsTranscribing, setStage, setProgress, setSegments, setDetectedLanguage, setError, setModelReady])

  /** Stop live transcription and do a final full pass (mic + system mixed). */
  const stopLive = useCallback(async (): Promise<TranscriptSegment[]> => {
    // Set stopping state immediately
    setIsStopping(true)
    setStage('Stopping… processing remaining audio')
    setQueueCount(0)

    // Stop periodic transcription
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Disconnect mic audio nodes (stops new audio from accumulating)
    if (micScriptNodeRef.current) {
      micScriptNodeRef.current.disconnect()
      micScriptNodeRef.current = null
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
      await micAudioCtxRef.current.close()
      micAudioCtxRef.current = null
    }

    // Disconnect system audio nodes
    if (sysScriptNodeRef.current) {
      sysScriptNodeRef.current.disconnect()
      sysScriptNodeRef.current = null
    }
    if (sysAudioCtxRef.current && sysAudioCtxRef.current.state !== 'closed') {
      await sysAudioCtxRef.current.close()
      sysAudioCtxRef.current = null
    }

    // Wait for in-progress transcription (with timeout to avoid infinite hang)
    const waitStart = Date.now()
    while (isTranscribingRef.current && Date.now() - waitStart < 30_000) {
      await new Promise((r) => setTimeout(r, 100))
    }
    // Force-reset if it's still stuck
    isTranscribingRef.current = false

    // Final full pass — merge mic + system audio
    const totalSamples = micTotalSamplesRef.current + sysTotalSamplesRef.current
    if (totalSamples > 0) {
      setStage('Final transcription pass…')
      setProgress(0)

      const micMerged = mergeChunks(micSamplesRef.current, micTotalSamplesRef.current)
      const sysMerged = mergeChunks(sysSamplesRef.current, sysTotalSamplesRef.current)

      let finalAudio: Float32Array
      if (sysMerged.length === 0) {
        finalAudio = micMerged
      } else if (micMerged.length === 0) {
        finalAudio = sysMerged
      } else {
        const length = Math.max(micMerged.length, sysMerged.length)
        finalAudio = new Float32Array(length)
        for (let i = 0; i < length; i++) {
          const a = i < micMerged.length ? micMerged[i] : 0
          const b = i < sysMerged.length ? sysMerged[i] : 0
          finalAudio[i] = (a + b) / 2
        }
      }

      try {
        const model = useTranscriptionStore.getState().whisperModel
        const result = await transcribe(finalAudio, model, languageRef.current, ({ progress, stage }) => {
          if (progress >= 0) setProgress(progress)
          if (stage) setStage(stage)
        })
        setSegments(result.segments)
        setDetectedLanguage(result.detectedLanguage)
        setIsTranscribing(false)
        setIsStopping(false)
        setQueueCount(0)
        setProgress(100)
        setStage('Transcription complete')
        return result.segments
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setIsTranscribing(false)
        setIsStopping(false)
        setQueueCount(0)
        return []
      }
    }

    setIsTranscribing(false)
    setIsStopping(false)
    setQueueCount(0)
    return useTranscriptionStore.getState().segments
  }, [mergeChunks, setStage, setProgress, setSegments, setDetectedLanguage, setError, setIsTranscribing, setIsStopping, setQueueCount])

  return { startLive, stopLive, discardLive, preloadModel, isModelReady }
}
