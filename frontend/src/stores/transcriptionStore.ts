import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WhisperModelId } from '../lib/whisper'

export type TranscriptionMode = 'local' | 'remote'

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

interface TranscriptionState {
  /** "local" = client-side Whisper, "remote" = server pipeline */
  mode: TranscriptionMode
  /** Which Whisper model to use for local transcription */
  whisperModel: WhisperModelId
  /** Whether the Whisper model has been downloaded and cached */
  modelReady: boolean
  /** Current local transcription progress (0–100) */
  progress: number
  /** Current stage label (loading, transcribing, etc.) */
  stage: string | null
  /** Error message if transcription failed */
  error: string | null
  /** Transcribed segments from local Whisper */
  segments: TranscriptSegment[]
  /** Whether transcription is currently running */
  isTranscribing: boolean
  /** Detected language from transcription */
  detectedLanguage: string | null
  /** Number of audio chunks waiting to be transcribed */
  queueCount: number
  /** Whether stop was clicked and remaining chunks are being processed */
  isStopping: boolean

  setMode: (mode: TranscriptionMode) => void
  setWhisperModel: (model: WhisperModelId) => void
  setModelReady: (ready: boolean) => void
  setProgress: (progress: number) => void
  setStage: (stage: string | null) => void
  setError: (error: string | null) => void
  setSegments: (segments: TranscriptSegment[]) => void
  setIsTranscribing: (v: boolean) => void
  setDetectedLanguage: (lang: string | null) => void
  setQueueCount: (count: number) => void
  setIsStopping: (v: boolean) => void
  reset: () => void
}

export const useTranscriptionStore = create<TranscriptionState>()(
  persist(
    (set) => ({
      mode: 'local',
      whisperModel: 'tiny',
      modelReady: false,
      progress: 0,
      stage: null,
      error: null,
      segments: [],
      isTranscribing: false,
      detectedLanguage: null,
      queueCount: 0,
      isStopping: false,

      setMode: (mode) => set({ mode }),
      setWhisperModel: (model) => set({ whisperModel: model, modelReady: false }),
      setModelReady: (ready) => set({ modelReady: ready }),
      setProgress: (progress) => set({ progress }),
      setStage: (stage) => set({ stage }),
      setError: (error) => set({ error }),
      setSegments: (segments) => set({ segments }),
      setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
      setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
      setQueueCount: (count) => set({ queueCount: count }),
      setIsStopping: (isStopping) => set({ isStopping }),
      reset: () => set({
        progress: 0,
        stage: null,
        error: null,
        segments: [],
        isTranscribing: false,
        detectedLanguage: null,
        queueCount: 0,
        isStopping: false,
      }),
    }),
    {
      name: 'qv-transcription',
      // Only persist user preferences and results — not runtime state
      partialize: (state) => ({
        mode: state.mode,
        whisperModel: state.whisperModel,
        segments: state.segments,
        detectedLanguage: state.detectedLanguage,
      }),
    },
  ),
)
