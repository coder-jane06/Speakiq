import { useState, useEffect } from 'react'
import { API_URL } from '../constants'
import type { Topic } from '../types'
import { RefreshCw } from 'lucide-react'

interface TopicCardProps {
  onReady: (topic: Topic) => void
}

export function TopicCard({ onReady }: TopicCardProps) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTopic = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/sessions/topic`)
      if (res.ok) {
        const data = await res.json()
        setTopic(data)
        onReady(data)
      }
    } catch (err) {
      console.error('Failed to fetch topic:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTopic()
  }, [])

  if (loading && !refreshing) {
    return (
      <div className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] p-8 flex items-center justify-center min-h-[180px] shadow-sm">
         <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-md)] border-t-[var(--accent)] animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="w-full relative group">
      {/* Decorative gradient border effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--border-md)] to-transparent rounded-[25px] z-0 opacity-50 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="w-full relative z-10 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] p-8 md:p-10 text-center shadow-lg transition-transform duration-300">
        
        {/* Topic Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] mb-6">
           <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
           <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Today's Topic</span>
        </div>
        
        <h2 className="text-[22px] md:text-[28px] font-medium text-primary leading-snug mb-8">
          {topic?.text || 'Discuss a time when you had to make a difficult decision.'}
        </h2>

        <button 
          onClick={() => { setRefreshing(true); fetchTopic(); }}
          disabled={refreshing}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-primary hover:border-[var(--border-md)] transition-colors text-[14px] font-medium active:scale-95"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Loading...' : 'Get another topic'}
        </button>
      </div>
    </div>
  )
}
