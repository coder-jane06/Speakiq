interface CountdownRingProps {
  secondsLeft: number
  progress: number       // 0 → 1
  size?: number
  color?: string
}

export function CountdownRing({
  secondsLeft,
  progress,
  size = 160,
  color = 'var(--accent)',
}: CountdownRingProps) {
  const stroke    = 6
  const radius    = (size - stroke * 2) / 2
  const cx        = size / 2
  const circumference = 2 * Math.PI * radius

  // Dash offset goes from 0 (full) to circumference (empty)
  const dashOffset = circumference * (1 - progress)

  // Color shifts amber when under 10s, red under 5s
  const ringColor =
    secondsLeft <= 5  ? '#F87171' :
    secondsLeft <= 10 ? '#FBBF24' :
    color

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={cx} cy={cx} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          style={{ color: 'rgba(255,255,255,0.08)' }}
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cx} r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease' }}
        />
      </svg>

      {/* Seconds label centered inside the ring */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.28,
          fontWeight: 500,
          color: ringColor,
          lineHeight: 1,
          transition: 'color 0.3s ease',
          fontFamily: 'var(--font-mono, monospace)',
        }}>
          {secondsLeft}
        </span>
        <span style={{
          fontSize: size * 0.1,
          color: 'rgba(255,255,255,0.35)',
          marginTop: 4,
          letterSpacing: '0.05em',
        }}>
          sec
        </span>
      </div>
    </div>
  )
}
