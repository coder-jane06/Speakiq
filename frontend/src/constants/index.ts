// ─── Session ────────────────────────────────────────────────
export type SessionState =
  | 'idle'
  | 'prep'
  | 'recording'
  | 'uploading'
  | 'analyzing'
  | 'results'
  | 'error'

export interface Topic {
  id: string
  text: string
  tier: 'easy' | 'medium' | 'hard'
  category: string
}

export interface Session {
  id: string
  user_id: string
  topic: Topic
  created_at: string
  audio_url: string | null
  status: 'pending' | 'analyzing' | 'complete' | 'failed'
}

// ─── Analysis ───────────────────────────────────────────────
export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface Pause {
  start: number
  end: number
  duration: number
}

export interface FillerDetail {
  [word: string]: number
}

export interface FillerPosition {
  word: string
  timestamp: number
}

export interface SessionMetrics {
  transcript: string
  words: WordTimestamp[]
  filler_count: number
  filler_detail: FillerDetail
  filler_positions: FillerPosition[]
  wpm: number
  pause_count: number
  longest_pause_sec: number
  pause_list: Pause[]
  pitch_mean: number
  pitch_std: number
  energy_variance: number
  silence_percentage: number
  ttr_score: number
  hedge_word_count: number
  sentence_count: number
}

// ─── Coaching ───────────────────────────────────────────────
export interface CoachingScores {
  filler: number
  delivery: number
  structure: number
  vocab: number
  confidence: number
}

export type FocusArea =
  | 'filler_words'
  | 'pacing'
  | 'pausing'
  | 'delivery_monotony'
  | 'idea_structure'
  | 'vocabulary'

export interface CoachingReport {
  score: CoachingScores
  what_went_well: string
  priority_fix: string
  example_moment: string | null
  drill_for_tomorrow: string
  encouragement: string
  focus_area: FocusArea
}

// ─── User Profile ────────────────────────────────────────────
export type TrendDirection = 'improving' | 'regressing' | 'stable'

export interface UserProfile {
  id: string
  user_id: string
  total_sessions: number
  filler_score: number
  delivery_score: number
  structure_score: number
  vocab_score: number
  confidence_score: number
  top_fillers: string[]
  coached_on: FocusArea[]
  last_coached: FocusArea | null
  filler_trend: TrendDirection
  delivery_trend: TrendDirection
  structure_trend: TrendDirection
  current_streak: number
  longest_streak: number
}

// ─── API responses ───────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  error: string | null
}

export interface UploadSessionResponse {
  session_id: string
  status: 'pending'
}
