import { BarChart3, AlertCircle } from 'lucide-react'

interface FillerWord {
  word: string
  count: number
  timestamps?: number[]
}

interface FillerBreakdownProps {
  fillers: FillerWord[]
}

export const FillerBreakdown = ({ fillers }: FillerBreakdownProps) => {
  // Sort fillers by count (highest first)
  const sortedFillers = [...fillers]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Show top 10

  const maxCount = sortedFillers.length > 0 ? sortedFillers[0].count : 1
  const totalFillers = sortedFillers.reduce((sum, f) => sum + f.count, 0)

  if (sortedFillers.length === 0 || totalFillers === 0) {
    return (
      <div className="w-full">
        <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-500" />
          Filler Word Analysis
        </h3>
        
        <div className="p-8 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h4 className="text-[18px] font-bold text-[var(--text-primary)] mb-2">
            No Filler Words Detected!
          </h4>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-md mx-auto">
            You spoke clearly without using "um", "uh", "like", or other crutch words. 
            This shows excellent awareness and control.
          </p>
        </div>
      </div>
    )
  }

  // Color palette for different fillers
  const getFillerColor = (index: number) => {
    const colors = [
      '#EF4444', // red
      '#F59E0B', // amber
      '#F97316', // orange
      '#EC4899', // pink
      '#8B5CF6', // purple
      '#6366F1', // indigo
      '#3B82F6', // blue
      '#14B8A6', // teal
      '#10B981', // emerald
      '#84CC16', // lime
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="w-full">
      <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-amber-500" />
        Filler Word Breakdown
      </h3>

      <div className="p-6 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
        {/* Summary header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Total Filler Words
            </p>
            <p className="text-[32px] font-[800] text-[var(--text-primary)] leading-none">
              {totalFillers}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
              Unique Types
            </p>
            <p className="text-[32px] font-[800] text-[var(--text-primary)] leading-none">
              {sortedFillers.length}
            </p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="space-y-3 mb-6">
          {sortedFillers.map((filler, index) => {
            const percentage = (filler.count / maxCount) * 100
            const color = getFillerColor(index)

            return (
              <div key={filler.word} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)] capitalize min-w-[60px]">
                      "{filler.word}"
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                      ({filler.count} {filler.count === 1 ? 'time' : 'times'})
                    </span>
                  </div>
                  <span className="text-[12px] font-bold" style={{ color }}>
                    {Math.round((filler.count / totalFillers) * 100)}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-8 rounded-lg bg-[var(--bg-hover)] overflow-hidden relative group-hover:shadow-md transition-all">
                  <div
                    className="h-full flex items-center px-3 transition-all duration-700 ease-out"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: `${color}20`,
                      borderRight: `3px solid ${color}`,
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color }}>
                      {filler.count}×
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Advice box */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <strong className="text-amber-500">Focus on your top crutch word:</strong>
            <span className="ml-1">
              Your most frequent filler is <strong className="text-[var(--text-primary)]">"{sortedFillers[0].word}"</strong>.
              {sortedFillers[0].count > 5 ? (
                <> Practice catching yourself before saying it. Try pausing silently instead.</>
              ) : (
                <> You're doing well! Keep building awareness of when you use it.</>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
