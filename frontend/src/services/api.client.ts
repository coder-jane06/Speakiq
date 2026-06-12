import axios from 'axios'
import { API_URL } from '../constants'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// Attach Supabase JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('supabase_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normalize error shape so callers don't need to inspect axios internals
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number = error.response?.status ?? 0
    const message: string =
      error.response?.data?.detail ??
      error.response?.data?.message ??
      error.message ??
      'An unexpected error occurred'

    // Only log unexpected errors — 401 (auth required) and 404 (not found)
    // are handled by callers and don't need console noise.
    if (status >= 500 || status === 0) {
      console.error(`[apiClient] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}:`, message)
    }

    return Promise.reject(new Error(message))
  }
)

export default apiClient
