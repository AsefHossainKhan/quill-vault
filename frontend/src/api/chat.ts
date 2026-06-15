import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import type { ChatMessage, ChatResponse } from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

/**
 * Dedicated axios instance for chat — longer timeout (2 min) since LLM calls
 * can take a while, especially on first request with model cold-start.
 */
const chatClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

chatClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

chatClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)

/**
 * Fetch chat history for a recording.
 */
export async function getChatMessages(recordingId: string): Promise<ChatMessage[]> {
  const { data } = await chatClient.get<ChatMessage[]>(
    `/recordings/${recordingId}/chat`,
  )
  return data
}

/**
 * Send a message with selected transcript context types.
 * The backend fetches the actual transcript content from the DB.
 */
export async function sendChatMessage(
  recordingId: string,
  message: string,
  contextTypes: string[],
): Promise<ChatResponse> {
  const { data } = await chatClient.post<ChatResponse>(
    `/recordings/${recordingId}/chat`,
    { message, context_types: contextTypes },
  )
  return data
}

/**
 * Delete all chat messages for a recording.
 */
export async function resetChat(recordingId: string): Promise<void> {
  await chatClient.delete(`/recordings/${recordingId}/chat`)
}
