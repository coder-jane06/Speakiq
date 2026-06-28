import { useCallback, useRef, useState, useEffect } from 'react'
import type { SessionState, Topic } from '../types'
import { PREP_DURATION_SECS, RECORDING_DURATION_SECS, API_URL } from '../constants'
import { supabase } from '../services/supabase'

interface UseSessionFlowReturn {
  state:           SessionState
  topic:           Topic | null
  sessionId:       string | null
  error:           string | null
  startPrep:       (topic: Topic, options?: SessionOptions) => void
  startRecording:  () => void
  finishRecording: (blob: Blob) => void
  skipPrep:        () => void
  reset:           () => void
  prepSecsLeft:    number
  recSecsLeft:     number
  prepProgress:    number
  recProgress:     number
  recordingDuration: number
  pauseTimer:      () => void
  resumeTimer:     () => void
}

interface SessionOptions {
  speakingGoal?: string
  difficultyTier?: string
}

export function useSessionFlow(): UseSessionFlowReturn {
  const [state,     setState]     = useState<SessionState>('idle')
  const [topic,     setTopic]     = useState<Topic | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  // Respect the user's chosen session length from onboarding
  const [recordingDuration, setRecordingDuration] = useState(RECORDING_DURATION_SECS)

  const [prepSecsLeft, setPrepSecsLeft] = useState(PREP_DURATION_SECS)
  const [recSecsLeft,  setRecSecsLeft]  = useState(recordingDuration)
  const prepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const topicRef = useRef<Topic | null>(null)
  const sessionOptionsRef = useRef<SessionOptions>({})
  const recordingDurationRef = useRef(recordingDuration)

  // Load user's preferred recording duration from profile-status endpoint
  useEffect(() => {
    const loadDuration = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        const res = await fetch(`${API_URL}/dashboard/profile-status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const dur = Math.max(30, Math.min(Number(data.recording_duration_secs) || RECORDING_DURATION_SECS, 300))
          setRecordingDuration(dur)
          setRecSecsLeft(dur)
          recordingDurationRef.current = dur
        }
      } catch {
        // silently fall back to default
      }
    }
    loadDuration()
  }, [])

  const clearIntervals = () => {
    if (prepIntervalRef.current) clearInterval(prepIntervalRef.current)
    if (recIntervalRef.current)  clearInterval(recIntervalRef.current)
  }

  // Clean up intervals when component using this hook unmounts
  useEffect(() => {
    return () => clearIntervals()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startPrep = useCallback((t: Topic, options: SessionOptions = {}) => {
    setTopic(t)
    topicRef.current = t
    sessionOptionsRef.current = options
    setPrepSecsLeft(PREP_DURATION_SECS)
    setState('prep')

    prepIntervalRef.current = setInterval(() => {
      setPrepSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current!)
          setState('recording')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const skipPrep = useCallback(() => {
    if (prepIntervalRef.current) clearInterval(prepIntervalRef.current)
    setPrepSecsLeft(0)
    setState('recording')
  }, [])

  const startRecording = useCallback(() => {
    const dur = recordingDurationRef.current
    setRecSecsLeft(dur)
    if (recIntervalRef.current) clearInterval(recIntervalRef.current)
    recIntervalRef.current = setInterval(() => {
      setRecSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(recIntervalRef.current!)
          recIntervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const pauseTimer = useCallback(() => {
    if (recIntervalRef.current) {
      clearInterval(recIntervalRef.current)
      recIntervalRef.current = null
    }
  }, [])

  const resumeTimer = useCallback(() => {
    if (!recIntervalRef.current) {
      recIntervalRef.current = setInterval(() => {
        setRecSecsLeft(prev => {
          if (prev <= 1) {
            clearInterval(recIntervalRef.current!)
            recIntervalRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [])

  const finishRecording = useCallback(async (blob: Blob) => {
    clearIntervals()
    setState('uploading')
    setError(null)

    const currentTopic = topicRef.current

    try {
      const formData = new FormData()
      formData.append('audio',      blob, 'recording.webm')
      formData.append('topic_id',   currentTopic?.id    ?? 'fallback')
      formData.append('topic_text', currentTopic?.text  ?? '')
      if (sessionOptionsRef.current.speakingGoal) {
        formData.append('speaking_goal', sessionOptionsRef.current.speakingGoal)
      }
      if (sessionOptionsRef.current.difficultyTier) {
        formData.append('difficulty_tier', sessionOptionsRef.current.difficultyTier)
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${API_URL}/sessions/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Upload failed')
      }

      const data = await res.json()
      setSessionId(data.session_id)
      setState('analyzing')

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      console.error('[useSessionFlow] finishRecording error:', msg)
      setError(msg)
      setState('error')
    }
  }, [])

  const reset = useCallback(() => {
    clearIntervals()
    setState('idle')
    setTopic(null)
    topicRef.current = null
    sessionOptionsRef.current = {}
    setSessionId(null)
    setError(null)
    setPrepSecsLeft(PREP_DURATION_SECS)
    setRecSecsLeft(recordingDurationRef.current)
  }, [])

  return {
    state, topic, sessionId, error,
    startPrep, startRecording, finishRecording, skipPrep, reset,
    prepSecsLeft, recSecsLeft,
    prepProgress: prepSecsLeft / PREP_DURATION_SECS,
    recProgress:  recSecsLeft  / recordingDurationRef.current,
    recordingDuration,
    pauseTimer,
    resumeTimer,
  }
}
