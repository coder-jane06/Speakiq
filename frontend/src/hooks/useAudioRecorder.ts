import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface AudioPreferences {
  mic: string
  noiseCancellation: boolean
  sensitivity: number
  autoGain: boolean
  quality: string
  voiceEnhancement: boolean
  livePreview: boolean
}

interface UseAudioRecorderReturn {
  isRecording:   boolean
  isPaused:      boolean
  isMuted:       boolean
  audioBlob:     Blob | null
  analyserNode:  AnalyserNode | null
  startRecording: (prefs?: AudioPreferences) => Promise<void>
  stopRecording:  () => void
  pauseRecording: () => void
  resumeRecording: () => void
  toggleMute:     () => void
  error:          string | null
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording,  setIsRecording]  = useState(false)
  const [isPaused,     setIsPaused]     = useState(false)
  const [isMuted,      setIsMuted]      = useState(false)
  const [audioBlob,    setAudioBlob]    = useState<Blob | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)

  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences | null>(null)
  
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          const res = await fetch(`${API_URL}/dashboard/profile-status`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.audio_preferences) {
              setAudioPrefs(data.audio_preferences)
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch audio preferences:", e)
      }
    }
    fetchPrefs()
  }, [])

  const startRecording = useCallback(async (manualPrefs?: AudioPreferences) => {
    const prefs = manualPrefs || audioPrefs
    setError(null)
    setAudioBlob(null)
    chunksRef.current = []

    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: prefs?.noiseCancellation ?? true,
        autoGainControl: prefs?.autoGain ?? true,
        echoCancellation: true
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      streamRef.current = stream

      // Set up Web Audio API for waveform visualisation
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx  = new AudioContextClass()
      if (audioCtx.state === 'suspended') { await audioCtx.resume() }
      audioCtxRef.current = audioCtx
      const source    = audioCtx.createMediaStreamSource(stream)
      const analyser  = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      setAnalyserNode(analyser)

      // Pick the best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setIsRecording(false)

        // Clean up stream tracks
        stream.getTracks().forEach(t => t.stop())
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(console.error)
        }
        setAnalyserNode(null)
      }

      setIsPaused(false)
      setIsMuted(false)
      recorder.start(250)   // 250ms timeslice for smooth waveform
      setIsRecording(true)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
      console.error('[useAudioRecorder] startRecording failed:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const nextMuted = !isMuted
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted
      })
      setIsMuted(nextMuted)
    }
  }, [isMuted])

  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch(console.error)
      }
    }
  }, [])

  return {
    isRecording,
    isPaused,
    isMuted,
    audioBlob,
    analyserNode,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMute,
    error
  }
}
