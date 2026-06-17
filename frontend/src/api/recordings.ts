import { apiClient } from './client'
import type {
  Recording,
  Transcript,
  TranscriptType,
  JobStatus,
  Speaker,
} from '../types/api'

export interface UploadRecordingResult {
  job_id: string
  recording_id: string
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

// ── Recording List ────────────────────────────────────────────────────────────

export async function listRecordings(): Promise<Recording[]> {
  const { data } = await apiClient.get<Recording[]>('/recordings')
  return data
}

// ── Recording Detail ──────────────────────────────────────────────────────────

export async function getRecording(recordingId: string): Promise<Recording> {
  const { data } = await apiClient.get<Recording>(`/recordings/${recordingId}`)
  return data
}

// ── Recording Update ──────────────────────────────────────────────────────────

export async function updateRecording(
  recordingId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data } = await apiClient.patch(`/recordings/${recordingId}`, { name })
  return data
}

// ── Recording Delete ──────────────────────────────────────────────────────────

export async function deleteRecording(recordingId: string): Promise<void> {
  await apiClient.delete(`/recordings/${recordingId}`)
}

// ── Auto-Name ─────────────────────────────────────────────────────────────────

export async function autoNameRecording(
  recordingId: string,
): Promise<{ name: string }> {
  const { data } = await apiClient.post(`/recordings/${recordingId}/auto-name`)
  return data
}

// ── Transcripts ───────────────────────────────────────────────────────────────

export async function getTranscripts(recordingId: string): Promise<Transcript[]> {
  const { data } = await apiClient.get<Transcript[]>(
    `/recordings/${recordingId}/transcripts`,
  )
  return data
}

export async function getTranscript(
  recordingId: string,
  type: TranscriptType,
): Promise<Transcript> {
  const { data } = await apiClient.get<Transcript>(
    `/recordings/${recordingId}/transcripts/${type}`,
  )
  return data
}

// ── Job Status ────────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await apiClient.get<JobStatus>(`/jobs/${jobId}/status`)
  return data
}

// ── Speakers ──────────────────────────────────────────────────────────────────

export async function getSpeakers(recordingId: string): Promise<Speaker[]> {
  const { data } = await apiClient.get<Speaker[]>(
    `/recordings/${recordingId}/speakers`,
  )
  return data
}
