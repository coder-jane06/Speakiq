import { useEffect, useRef, useState } from 'react'

interface ScoreRingProps {
  score: number;
  label?: string;
  size?: number;
}

export function ScoreRing({ score, label, size = 120 }: ScoreRingProps) {
  const [offset, setOffset] = useState(0);
  const circleRef = useRef<SVGCircleElement>(null);
  const strokeWidth = Math.max(4, size * 0.08);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    // Animate the fill
    const targetOffset = circumference - (score / 100) * circumference;
    // Tiny delay to let initial render happen
    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  let color = 'var(--red)';
  if (score >= 50) color = 'var(--amber)';
  if (score >= 75) color = 'var(--accent)';

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-md)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset || circumference}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-[700] tracking-tight leading-none text-primary" style={{ fontSize: size * 0.28 }}>
          {score}
        </span>
        {label && (
          <span className="text-secondary font-semibold uppercase tracking-wider mt-1" style={{ fontSize: size * 0.1 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
