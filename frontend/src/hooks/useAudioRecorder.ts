import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAudioRecorderReturn {
  isRecording:   boolean
  audioBlob:     Blob | null
  analyserNode:  AnalyserNode | null
  startRecording: () => Promise<void>
  stopRecording:  () => void
  error:          string | null
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording,  setIsRecording]  = useState(false)
  const [audioBlob,    setAudioBlob]    = useState<Blob | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up Web Audio API for waveform visualisation
      const audioCtx  = new AudioContext()
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

      recorder.start(250)   // 250ms timeslice for smooth waveform
      setIsRecording(true)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
      console.error('[useAudioRecorder] startRecording failed:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch(console.error)
      }
    }
  }, [])

  return { isRecording, audioBlob, analyserNode, startRecording, stopRecording, error }
}
