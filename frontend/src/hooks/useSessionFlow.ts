import { useCallback, useRef, useState } from 'react'
import type { SessionState, Topic } from '../types'
import { PREP_DURATION_SECS, RECORDING_DURATION_SECS, API_URL } from '../constants'
import { supabase } from '../services/supabase'

interface UseSessionFlowReturn {
  state:           SessionState
  topic:           Topic | null
  sessionId:       string | null
  error:           string | null
  startPrep:       (topic: Topic) => void
  startRecording:  () => void
  finishRecording: (blob: Blob) => void
  skipPrep:        () => void
  reset:           () => void
  prepSecsLeft:    number
  recSecsLeft:     number
  prepProgress:    number
  recProgress:     number
}

export function useSessionFlow(): UseSessionFlowReturn {
  const [state,     setState]     = useState<SessionState>('idle')
  const [topic,     setTopic]     = useState<Topic | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const [prepSecsLeft, setPrepSecsLeft] = useState(PREP_DURATION_SECS)
  const [recSecsLeft,  setRecSecsLeft]  = useState(RECORDING_DURATION_SECS)
  const prepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Store the topic ref so it's always available in callbacks
  const topicRef = useRef<Topic | null>(null)

  const clearIntervals = () => {
    if (prepIntervalRef.current) clearInterval(prepIntervalRef.current)
    if (recIntervalRef.current)  clearInterval(recIntervalRef.current)
  }

  const startPrep = useCallback((t: Topic) => {
    // Store topic in BOTH state and ref
    // This guarantees the same topic persists through all phases
    setTopic(t)
    topicRef.current = t
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
    setRecSecsLeft(RECORDING_DURATION_SECS)
    recIntervalRef.current = setInterval(() => {
      setRecSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(recIntervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const finishRecording = useCallback(async (blob: Blob) => {
    clearIntervals()
    setState('uploading')
    setError(null)

    // Use topicRef to guarantee we use the ORIGINAL prep topic
    const currentTopic = topicRef.current

    try {
      const formData = new FormData()
      formData.append('audio',      blob, 'recording.webm')
      formData.append('topic_id',   currentTopic?.id    ?? 'fallback')
      formData.append('topic_text', currentTopic?.text  ?? '')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${API_URL}/sessions/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body:   formData,
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
    setSessionId(null)
    setError(null)
    setPrepSecsLeft(PREP_DURATION_SECS)
    setRecSecsLeft(RECORDING_DURATION_SECS)
  }, [])

  return {
    state, topic, sessionId, error,
    startPrep, startRecording, finishRecording, skipPrep, reset,
    prepSecsLeft, recSecsLeft,
    prepProgress: prepSecsLeft / PREP_DURATION_SECS,
    recProgress:  recSecsLeft  / RECORDING_DURATION_SECS,
  }
}
