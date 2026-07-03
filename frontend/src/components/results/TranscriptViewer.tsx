import { useEffect, useRef } from 'react'

interface Word {
  word: string
  start: number
  end: number
  type: 'filler' | 'hedge' | 'normal'
}

interface TranscriptViewerProps {
  words: Word[]
  currentTime: number
  onWordClick: (time: number) => void
}

export const TranscriptViewer = ({ words, currentTime, onWordClick }: TranscriptViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeWordRef = useRef<HTMLSpanElement>(null)

  // Find the currently active word based on audio time
  const findActiveWordIndex = () => {
    return words.findIndex(
      (word) => currentTime >= word.start && currentTime <= word.end
    )
  }

  const activeIndex = findActiveWordIndex()

  // Auto-scroll to keep active word visible
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current
      const activeWord = activeWordRef.current
      
      const containerRect = container.getBoundingClientRect()
      const wordRect = activeWord.getBoundingClientRect()
      
      // Check if word is out of view
      if (
        wordRect.top < containerRect.top ||
        wordRect.bottom > containerRect.bottom
      ) {
        activeWord.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }, [activeIndex])

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-[14px]">
        No transcript available
      </div>
    )
  }

  const getWordStyle = (word: Word, index: number) => {
    const isActive = index === activeIndex
    const isFiller = word.type === 'filler'
    const isHedge = word.type === 'hedge'

    let className = 'inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-all duration-200 '
    
    if (isActive) {
      className += 'bg-yellow-300/40 dark:bg-yellow-500/30 font-bold scale-105 '
    } else {
      className += 'hover:bg-[var(--bg-hover)] '
    }

    let style: React.CSSProperties = {}

    if (isFiller) {
      style.color = '#EF4444'
      style.textDecoration = 'underline wavy 2px'
      style.textUnderlineOffset = '4px'
      style.fontWeight = '600'
    } else if (isHedge) {
      style.color = '#F59E0B'
      style.textDecoration = 'underline solid 1px'
      style.textUnderlineOffset = '3px'
    }

    return { className, style }
  }

  return (
    <div
      ref={containerRef}
      className="leading-relaxed text-[15px] text-[var(--text-primary)] font-medium overflow-y-auto"
      style={{ maxHeight: '400px' }}
    >
      {/* Legend */}
      <div className="sticky top-0 bg-[var(--bg-card)] pb-3 mb-3 border-b border-[var(--border)] flex items-center gap-4 text-[11px] font-bold flex-wrap z-10">
        <span className="text-[var(--text-tertiary)] uppercase tracking-wider">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-300/40 dark:bg-yellow-500/30" />
          <span className="text-[var(--text-secondary)]">Current word</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-1 bg-red-500 rounded" />
          <span className="text-red-500">Filler words</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-1 bg-amber-500 rounded" />
          <span className="text-amber-500">Hedge words</span>
        </div>
        <button
          onClick={() => {
            const firstFiller = words.find(w => w.type === 'filler')
            if (firstFiller) onWordClick(firstFiller.start)
          }}
          className="ml-auto px-3 py-1 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] transition-all text-[11px] font-bold"
        >
          Jump to first filler →
        </button>
      </div>

      {/* Transcript words */}
      <div className="space-y-2">
        {words.map((word, index) => {
          const { className, style } = getWordStyle(word, index)
          const isActive = index === activeIndex

          return (
            <span
              key={`${word.word}-${word.start}-${index}`}
              ref={isActive ? activeWordRef : null}
              className={className}
              style={style}
              onClick={() => onWordClick(word.start)}
              title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s${
                word.type !== 'normal' ? ` (${word.type})` : ''
              }`}
            >
              {word.word}
            </span>
          )
        })}
      </div>

      {/* Statistics footer */}
      <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-[12px] font-medium">
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-tertiary)]">
            Total words: <strong className="text-[var(--text-primary)]">{words.length}</strong>
          </span>
          <span className="text-[var(--text-tertiary)]">
            Fillers: <strong className="text-red-500">{words.filter(w => w.type === 'filler').length}</strong>
          </span>
          <span className="text-[var(--text-tertiary)]">
            Hedges: <strong className="text-amber-500">{words.filter(w => w.type === 'hedge').length}</strong>
          </span>
        </div>
        <span className="text-[var(--text-tertiary)] italic">
          Click any word to jump to that moment
        </span>
      </div>
    </div>
  )
}
