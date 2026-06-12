import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecordingState {
  /** Selected microphone device ID */
  micDeviceId: string
  /** Selected language for transcription */
  language: string
  /** Selected template ID for output generation */
  templateId: string | null
  /** Recording name (auto-filled or user-entered) */
  recordingName: string

  setMicDeviceId: (id: string) => void
  setLanguage: (lang: string) => void
  setTemplateId: (id: string | null) => void
  setRecordingName: (name: string) => void
}

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set) => ({
      micDeviceId: '',
      language: 'en',
      templateId: null,
      recordingName: '',

      setMicDeviceId: (id) => set({ micDeviceId: id }),
      setLanguage: (lang) => set({ language: lang }),
      setTemplateId: (id) => set({ templateId: id }),
      setRecordingName: (name) => set({ recordingName: name }),
    }),
    { name: 'qv-recording' },
  ),
)
