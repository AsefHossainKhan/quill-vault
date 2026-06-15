/** API response shapes */

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  username: string
}

export interface LoginRequest {
  identifier: string  // email or username
  password: string
}

/** Backend /auth/login returns only tokens */
export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  username: string
  email: string
  full_name?: string
  password: string
}

export interface RegisterResponse {
  id: string
  username: string
  email: string
}

export interface ApiError {
  detail: string
}

// ── Recording & Transcript Types ──────────────────────────────────────────────

export interface Recording {
  id: string
  name: string
  language: string
  duration_seconds: number | null
  created_at: string
  active_job_id: string | null
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface Transcript {
  id: string
  recording_id: string
  type: 'raw' | 'diarized' | 'named' | 'output'
  content: string
  template_id: string | null
  created_at: string
  updated_at: string
}

export type TranscriptType = Transcript['type']

export interface JobStatus {
  job_id: string
  stage: string
  progress: number
  error: string | null
  recording_id: string
}

/** Pipeline stages in order */
export const PIPELINE_STAGES = [
  'queued',
  'transcribing',
  'diarizing',
  'naming',
  'generating',
  'done',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export interface Speaker {
  id: string
  label: string
  name: string | null
  sample_start_seconds: number | null
  sample_end_seconds: number | null
}

// ── Chat Types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  response: string
}
