import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

interface DeliveryDiagnosisProps {
  wpm: number
  pitchVariance: number
  silenceCount: number
}

export const DeliveryDiagnosis = ({ wpm, pitchVariance, silenceCount }: DeliveryDiagnosisProps) => {
  // WPM Analysis: Ideal range is 130-150
  const getWPMStatus = () => {
    if (wpm < 100) return { label: 'Too Slow', color: '#F59E0B', icon: TrendingDown, advice: 'Speed up slightly' }
    if (wpm < 130) return { label: 'Slow', color: '#3B82F6', icon: Minus, advice: 'Consider increasing pace' }
    if (wpm <= 150) return { label: 'Ideal', color: '#22C55E', icon: TrendingUp, advice: 'Perfect pacing!' }
    if (wpm <= 180) return { label: 'Fast', color: '#3B82F6', icon: TrendingUp, advice: 'Slow down slightly' }
    return { label: 'Too Fast', color: '#EF4444', icon: TrendingUp, advice: 'Rushing - breathe!' }
  }

  // Pitch Variance: Measures vocal expressiveness (0-100+ Hz)
  const getPitchStatus = () => {
    if (pitchVariance < 20) return { label: 'Monotone', color: '#EF4444', icon: Minus, advice: 'Add vocal variety' }
    if (pitchVariance < 40) return { label: 'Low Variance', color: '#F59E0B', icon: Minus, advice: 'More expression needed' }
    if (pitchVariance <= 80) return { label: 'Expressive', color: '#22C55E', icon: Activity, advice: 'Great vocal variety!' }
    return { label: 'Very Dynamic', color: '#3B82F6', icon: Activity, advice: 'Highly expressive!' }
  }

  // Silence Analysis: Too many pauses can break flow
  const getSilenceStatus = () => {
    if (silenceCount < 3) return { label: 'Continuous', color: '#22C55E', icon: TrendingUp, advice: 'Excellent flow!' }
    if (silenceCount <= 8) return { label: 'Balanced', color: '#3B82F6', icon: Minus, advice: 'Good pause usage' }
    if (silenceCount <= 15) return { label: 'Frequent', color: '#F59E0B', icon: TrendingDown, advice: 'Reduce pauses' }
    return { label: 'Excessive', color: '#EF4444', icon: TrendingDown, advice: 'Too many breaks' }
  }

  const wpmStatus = getWPMStatus()
  const pitchStatus = getPitchStatus()
  const silenceStatus = getSilenceStatus()

  const renderGauge = (
    title: string,
    value: number,
    maxValue: number,
    status: ReturnType<typeof getWPMStatus>,
    unit: string
  ) => {
    const percentage = Math.min(100, (value / maxValue) * 100)
    const Icon = status.icon

    return (
      <div className="flex-1 p-5 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            {title}
          </h4>
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"
            style={{ backgroundColor: `${status.color}15`, color: status.color }}
          >
            <Icon size={12} />
            {status.label}
          </span>
        </div>

        {/* Circular gauge */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="var(--bg-hover)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={status.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-[800] text-[var(--text-primary)] leading-none">
              {Math.round(value)}
            </span>
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase mt-1">
              {unit}
            </span>
          </div>
        </div>

        {/* Advice */}
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
            {status.advice}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Activity size={18} className="text-blue-500" />
        Delivery Diagnosis
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderGauge('Speaking Pace', wpm, 200, wpmStatus, 'WPM')}
        {renderGauge('Vocal Variety', pitchVariance, 100, pitchStatus, 'Hz')}
        {renderGauge('Pause Count', silenceCount, 20, silenceStatus, 'pauses')}
      </div>

      {/* Explanation footer */}
      <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[12px] text-[var(--text-secondary)] leading-relaxed">
        <strong className="text-blue-500">💡 Understanding your metrics:</strong> 
        <span className="ml-1">
          <strong>WPM</strong> (words per minute) measures your speaking speed. 
          <strong className="ml-2">Vocal Variety</strong> shows how much your pitch changes (monotone vs expressive). 
          <strong className="ml-2">Pauses</strong> counts your silence gaps during speaking.
        </span>
      </div>
    </div>
  )
}
