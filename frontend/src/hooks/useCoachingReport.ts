import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { API_URL } from '../constants'

const API_BASE = API_URL ? `${API_URL}` : '' // Use root, since proxy handles '/sessions' natively
const MAX_WAIT_MS = 120000   // 2 minutes
const POLL_INTERVAL = 4000   // every 4 seconds

interface Metrics {
  wpm?: number
  duration_s?: number
  filler_count?: number
  filler_rate?: number
  filler_detail?: Record<string, number> | string
  filler_words?: Array<{ word: string; count: number; timestamps?: number[] }>
  words?: Array<{ word: string; start: number; end: number }> | string
  pause_list?: Array<{ start: number; end: number; duration: number }> | string
  pause_count?: number
  pitch_std?: number
  pitch_variance?: number
  pitch_mean?: number
  silence_gaps?: Array<{ start: number; end: number; duration: number }>
  silence_percentage?: number
  longest_pause_sec?: number
  coaching_report?: Record<string, unknown> | string
  delivery_score?: number
  structure_score?: number
  vocab_score?: number
  filler_score?: number
  confidence_score?: number
}

const SCORE_KEYS = ['filler', 'delivery', 'structure', 'vocab', 'confidence'] as const

function normalizeScores(rawScores: unknown): Record<(typeof SCORE_KEYS)[number], number> {
  if (!rawScores || typeof rawScores !== 'object') {
    throw new Error('Analysis report is missing score data.')
  }

  const normalized = {} as Record<(typeof SCORE_KEYS)[number], number>
  for (const key of SCORE_KEYS) {
    const value = Number((rawScores as Record<string, unknown>)[key])
    if (!Number.isFinite(value)) {
      throw new Error(`Analysis report is missing ${key} score data.`)
    }
    normalized[key] = Math.max(0, Math.min(100, Math.round(value)))
  }
  return normalized
}

export interface CoachingReport {
  // Scores map: { filler, delivery, structure, vocab, confidence }
  scores?: Record<string, number>
  // Feedback fields
  what_went_well?: string
  priority_fix?: string
  content_feedback?: string
  example_moment?: string
  encouragement?: string
  // New actionable coaching fields
  daily_drill: string
  mechanical_tip: string
  micro_habit: string
  worst_moment?: {
    quote: string
    timestamp_s: number
    what_went_wrong: string
  }
  rewritten_sentences?: Array<{
    before: string
    after: string
    improvement: string
  }>
  // Allow other dynamic keys from the API
  [key: string]: unknown
}

interface SessionData {
  id: string
  topic?: string
  status?: string
  session_metrics?: Metrics[] | Metrics | null
}

interface CoachingReportResult {
  loading: boolean
  error: string | null
  session: SessionData | null
  metrics: Metrics | null
  coaching: CoachingReport | null
}

export function useCoachingReport(sessionId: string | undefined): CoachingReportResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionData | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [coaching, setCoaching] = useState<CoachingReport | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided')
      setLoading(false)
      return
    }

    let elapsed = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log(`[Poll] Fetching session ${sessionId} (elapsed: ${elapsed}ms)`)
        }
        
        const { data: { session: authSession } } = await supabase.auth.getSession()
        const token = authSession?.access_token
        
        const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        })
        if (import.meta.env.DEV) {
          console.log(`[Poll] Response status: ${res.status}`)
        }

        if (res.status === 404) {
          // Pipeline still running - keep waiting
          if (!cancelled && elapsed < MAX_WAIT_MS) {
            elapsed += POLL_INTERVAL
            if (import.meta.env.DEV) {
              console.log(`[Poll] Not ready yet, retrying in ${POLL_INTERVAL}ms...`)
            }
            timer = setTimeout(poll, POLL_INTERVAL)
          } else {
            setError('Analysis timed out after 2 minutes. Please try again.')
            setLoading(false)
          }
          return
        }

        if (!res.ok) {
          throw new Error(`Server error ${res.status}`)
        }

        const data: SessionData = await res.json()
        if (import.meta.env.DEV) {
          console.log('[Poll] Got data:', JSON.stringify(data).slice(0, 200))
        }

        if (data.status === 'failed') {
          setError('Analysis failed on the server. Please try recording again.')
          setLoading(false)
          return
        }

        // Extract metrics (Supabase returns as array)
        const rawMetrics = Array.isArray(data.session_metrics)
          ? data.session_metrics[0]
          : data.session_metrics

        if (!rawMetrics || !rawMetrics.coaching_report) {
          // Data exists but pipeline not done saving
          if (!cancelled && elapsed < MAX_WAIT_MS) {
            elapsed += POLL_INTERVAL
            if (import.meta.env.DEV) {
              console.log('[Poll] Metrics not ready, retrying...')
            }
            timer = setTimeout(poll, POLL_INTERVAL)
          } else {
            setError('Analysis timed out. Please try again.')
            setLoading(false)
          }
          return
        }

        // Parse coaching_report if JSON string
        const coachingData = typeof rawMetrics.coaching_report === 'string'
          ? JSON.parse(rawMetrics.coaching_report)
          : rawMetrics.coaching_report

        if (!coachingData || typeof coachingData !== 'object') {
          throw new Error('Analysis report was malformed.')
        }

        const normalizedCoaching = {
          ...(coachingData as Record<string, unknown>),
          scores: normalizeScores((coachingData as Record<string, unknown>).scores)
        } as CoachingReport

        // Safe JSON parse helper
        const parseJson = (val: any, fallback: any) => {
          if (typeof val === 'string') {
            try { return JSON.parse(val) } catch { return fallback }
          }
          return val || fallback
        }

        const fillerDetail = parseJson(rawMetrics.filler_detail, {})
        const words = parseJson(rawMetrics.words, [])
        const pauseList = parseJson(rawMetrics.pause_list, [])
        
        // Construct duration_s from last word's end timestamp
        const duration_s = words.length > 0 ? words[words.length - 1].end : 0
        
        // Prepare filler_words for FillerBreakdown
        const filler_words = Object.entries(fillerDetail).map(([word, count]) => ({
          word,
          count: Number(count) || 0,
          timestamps: []
        }))

        if (import.meta.env.DEV) {
          console.log('[Poll] SUCCESS - coaching report loaded')
        }
        
        setSession(data)
        setMetrics({ 
          ...rawMetrics, 
          filler_detail: fillerDetail,
          words,
          pause_list: pauseList,
          pitch_variance: rawMetrics.pitch_variance ?? rawMetrics.pitch_std ?? 0,
          silence_gaps: pauseList,
          duration_s,
          filler_words
        })
        setCoaching(normalizedCoaching)
        setLoading(false)

      } catch (err) {
        console.error('[Poll] Error:', err)
        const message = err instanceof Error ? err.message : ''
        if (message.startsWith('Analysis report')) {
          setError(message)
          setLoading(false)
          return
        }
        if (!cancelled && elapsed < MAX_WAIT_MS) {
          // Don't count network blip as an attempt
          timer = setTimeout(poll, POLL_INTERVAL)
        } else {
          setError('Connection failed. Make sure the backend is running.')
          setLoading(false)
        }
      }
    }

    // Start polling after a 5 second initial delay
    timer = setTimeout(poll, 5000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId])

  return { loading, error, session, metrics, coaching }
}
