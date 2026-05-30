import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { API_URL } from '../constants'

const API_BASE = API_URL ? `${API_URL}` : '' // Use root, since proxy handles '/sessions' natively
const MAX_WAIT_MS = 120000   // 2 minutes
const POLL_INTERVAL = 4000   // every 4 seconds

interface Metrics {
  wpm?: number
  filler_count?: number
  filler_rate?: number
  filler_detail?: Record<string, number> | string
  pitch_std?: number
  silence_percentage?: number
  longest_pause_sec?: number
  coaching_report?: Record<string, unknown> | string
  delivery_score?: number
  structure_score?: number
  vocab_score?: number
  filler_score?: number
  confidence_score?: number
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

        // Parse filler_detail if JSON string
        const fillerDetail = typeof rawMetrics.filler_detail === 'string'
          ? JSON.parse(rawMetrics.filler_detail)
          : (rawMetrics.filler_detail || {})

        if (import.meta.env.DEV) {
          console.log('[Poll] SUCCESS - coaching report loaded')
        }
        
        setSession(data)
        setMetrics({ ...rawMetrics, filler_detail: fillerDetail })
        setCoaching(coachingData)
        setLoading(false)

      } catch (err) {
        console.error('[Poll] Error:', err)
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
