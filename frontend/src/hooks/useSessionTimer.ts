import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSessionTimerReturn {
  secondsLeft: number
  isRunning: boolean
  progress: number        // 0 → 1 (used by CountdownRing)
  start: () => void
  reset: (duration: number) => void
}

export function useSessionTimer(
  durationSecs: number,
  onComplete: () => void
): UseSessionTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(durationSecs)
  const [isRunning, setIsRunning]     = useState(false)
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef                 = useRef(onComplete)

  // Keep onComplete ref fresh without restarting the timer
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const start = useCallback(() => {
    setIsRunning(true)
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clear()
          setIsRunning(false)
          onCompleteRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const reset = useCallback((duration: number) => {
    clear()
    setIsRunning(false)
    setSecondsLeft(duration)
  }, [])

  // Clean up on unmount
  useEffect(() => () => clear(), [])

  const progress = secondsLeft / durationSecs

  return { secondsLeft, isRunning, progress, start, reset }
}
