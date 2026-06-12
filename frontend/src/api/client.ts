import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

/** Create a configured Axios instance for backend API calls */
export function createApiClient() {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Attach auth token to every request
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Handle 401 responses globally
  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status === 401) {
        useAuthStore.getState().logout()
      }
      return Promise.reject(error)
    },
  )

  return instance
}

export const apiClient = createApiClient()
