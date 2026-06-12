import { apiClient } from './client'

export interface UploadRecordingResult {
  jobId: string
  recordingId: string
}

export async function uploadRecording(
  name: string,
  micBlob: Blob,
  systemBlob: Blob | null,
  language: string,
  transcriptJson: string | null,
  onProgress: (percent: number) => void,
): Promise<UploadRecordingResult> {
  const form = new FormData()
  form.append('name', name)
  form.append('language', language)
  form.append('mic_audio', micBlob, 'mic.webm')
  if (systemBlob) {
    form.append('system_audio', systemBlob, 'system.webm')
  }
  // If client did local transcription, send the raw transcript JSON
  if (transcriptJson) {
    form.append('transcript', transcriptJson)
  }

  const { data } = await apiClient.post<UploadRecordingResult>('/recordings', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}
