import { Sparkles, ArrowRight } from 'lucide-react'

interface Rewrite {
  before: string
  after: string
  improvement: string
}

interface SentenceRewriteCardProps {
  rewrites: Rewrite[]
}

export const SentenceRewriteCard = ({ rewrites }: SentenceRewriteCardProps) => {
  if (!rewrites || rewrites.length === 0) {
    return null
  }

  // Show max 3 rewrites
  const displayRewrites = rewrites.slice(0, 3)

  return (
    <div className="w-full p-6 rounded-[20px] bg-gradient-to-br from-blue-500/10 via-[var(--bg-card)] to-indigo-500/5 border border-blue-500/30 shadow-md hover:shadow-blue-500/20 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Sparkles size={18} className="text-blue-500" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-blue-500">
            AI Sentence Rewrites
          </h3>
          <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
            See how to say it better
          </p>
        </div>
      </div>

      {/* Rewrites */}
      <div className="space-y-4">
        {displayRewrites.map((rewrite, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-blue-500/30 transition-all"
          >
            {/* Before */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                  ❌ Before
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed font-medium">
                {rewrite.before}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center my-2">
              <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
            </div>

            {/* After */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}>
                  ✓ Better
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-primary)] leading-relaxed font-semibold">
                {rewrite.after}
              </p>
            </div>

            {/* Improvement note */}
            {rewrite.improvement && (
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-[11px] text-blue-500 font-medium flex items-start gap-1.5">
                  <Sparkles size={12} className="shrink-0 mt-0.5" />
                  <span>{rewrite.improvement}</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-blue-500/20 text-[12px] text-[var(--text-secondary)]">
        <strong className="text-blue-500">💡 Practice tip:</strong> 
        <span className="ml-1">
          Read the "Better" versions out loud 3 times to build muscle memory for clearer phrasing.
        </span>
      </div>
    </div>
  )
}
