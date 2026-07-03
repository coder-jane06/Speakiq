import { AlertTriangle, Play } from 'lucide-react'

interface WorstMomentCardProps {
  quote: string
  timestamp_s: number
  what_went_wrong: string
  onJumpToTime: (time: number) => void
}

export const WorstMomentCard = ({
  quote,
  timestamp_s,
  what_went_wrong,
  onJumpToTime,
}: WorstMomentCardProps) => {
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full p-6 rounded-[20px] bg-gradient-to-br from-red-500/10 via-[var(--bg-card)] to-orange-500/5 border border-red-500/30 shadow-md hover:shadow-red-500/20 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-red-500">
              Moment to Improve
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
              Highest filler density
            </p>
          </div>
        </div>
        
        <button
          onClick={() => onJumpToTime(timestamp_s)}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 border border-red-500/30"
          title="Jump to this moment"
        >
          <Play size={12} />
          {formatTimestamp(timestamp_s)}
        </button>
      </div>

      {/* Quote */}
      <div className="mb-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] relative">
        {/* Quote marks */}
        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-[16px]">
          "
        </div>
        
        <p className="text-[14px] text-[var(--text-primary)] font-medium leading-relaxed italic pl-4">
          {quote}
        </p>
      </div>

      {/* Explanation */}
      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        <strong className="text-[var(--text-primary)]">Why this matters:</strong>
        <p className="mt-1">{what_went_wrong}</p>
      </div>

      {/* Action item */}
      <div className="mt-4 pt-4 border-t border-red-500/20">
        <p className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-2">
          <span className="text-red-500">💡</span>
          Next time: Pause and breathe before starting a new thought
        </p>
      </div>
    </div>
  )
}
