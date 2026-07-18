export const PREP_DURATION_SECS = 30
export const RECORDING_DURATION_SECS = 60
export const RECORDER_TIMESLICE_MS = 250

export const AUDIO_MIME_TYPE = 'audio/webm'
export const MAX_UPLOAD_SIZE_MB = 10
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

// A production Pages build cannot serve the API itself. Keep this explicit so a
// missing build variable is reported to the user instead of silently calling
// GitHub Pages and pretending a preference was saved.
export const API_URL = import.meta.env.DEV ? '' : (configuredApiUrl ?? '')
export const API_CONFIGURED = import.meta.env.DEV || Boolean(configuredApiUrl)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
export const APP_BASE_URL = import.meta.env.BASE_URL
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SESSION: '/session',
  RESULTS: '/session/:sessionId/results',
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
} as const

export const SESSION_STATE_ORDER = [
  'idle', 'prep', 'recording', 'uploading', 'analyzing', 'results',
] as const

export const SCORE_LABELS: Record<string, string> = {
  filler: 'Filler Words',
  delivery: 'Delivery',
  structure: 'Structure',
  vocab: 'Vocabulary',
  confidence: 'Confidence',
}

export const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'basically', 'literally',
  'actually', 'you know', 'i mean', 'kind of', 'sort of',
  'right', 'okay so', 'so yeah',
]
