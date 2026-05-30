// =============================================================
// frontend/src/components/results/DrillCard.tsx
//
// Displays a daily drill exercise with a 2-minute countdown timer.
// Features: SVG countdown ring, dark card with blue accent border,
// animated transitions, green completion state.
// =============================================================

import { useState, useEffect, useRef } from 'react'

interface DrillCardProps {
  drill: string
  duration?: number  // seconds, default 120
}

const RING_RADIUS = 42
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function DrillCard({ drill, duration = 120 }: DrillCardProps) {
  const [timeLeft, setTimeLeft]     = useState(duration)
  const [isRunning, setIsRunning]   = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false)
      setIsComplete(true)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, timeLeft])

  const handleStart = () => {
    if (!isComplete) setIsRunning(true)
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsComplete(false)
    setTimeLeft(duration)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress    = (duration - timeLeft) / duration          // 0 → 1
  const dashOffset  = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(96,165,250,0.25)',
      borderLeft: '3px solid #60A5FA',
      borderRadius: '0 16px 16px 0',
      padding: '20px 18px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>⏱️</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#60A5FA',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Daily Drill
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11, padding: '2px 8px',
          background: 'rgba(96,165,250,0.1)',
          border: '1px solid rgba(96,165,250,0.2)',
          borderRadius: 20, color: '#60A5FA',
        }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Drill text */}
      <p style={{
        fontSize: 14, color: '#d1d5db',
        lineHeight: 1.65, margin: '0 0 18px',
      }}>
        {drill}
      </p>

      {/* Timer / Completion state */}
      {isComplete ? (
        /* ── Completion ── */
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <p style={{ color: '#34D399', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>
              Drill complete!
            </p>
            <p style={{ color: 'rgba(52,211,153,0.6)', fontSize: 12, margin: 0 }}>
              Great work — you nailed it.
            </p>
          </div>
          <button
            onClick={handleReset}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid rgba(52,211,153,0.3)',
              color: '#34D399', borderRadius: 8,
              padding: '5px 10px', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Redo
          </button>
        </div>
      ) : isRunning ? (
        /* ── Running: countdown ring ── */
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              {/* Track */}
              <circle
                cx="50" cy="50" r={RING_RADIUS}
                fill="none"
                stroke="rgba(96,165,250,0.12)"
                strokeWidth="6"
              />
              {/* Progress arc */}
              <circle
                cx="50" cy="50" r={RING_RADIUS}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 1s linear',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                  filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.5))',
                }}
              />
            </svg>
            {/* Centered time */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                color: '#60A5FA', fontSize: 18,
                fontWeight: 700, fontFamily: 'monospace',
                letterSpacing: '-0.02em',
              }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{ color: 'rgba(96,165,250,0.5)', fontSize: 9, marginTop: 1 }}>
                left
              </span>
            </div>
          </div>

          <div>
            <p style={{ color: '#60A5FA', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
              In progress…
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              Stay focused on your drill until the timer ends.
            </p>
          </div>
        </div>
      ) : (
        /* ── Idle: start button ── */
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            background: 'rgba(96,165,250,0.1)',
            border: '1px solid rgba(96,165,250,0.3)',
            color: '#60A5FA',
            borderRadius: 10,
            padding: '11px 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
        >
          ▶ Start drill ({formatTime(duration)})
        </button>
      )}
    </div>
  )
}
