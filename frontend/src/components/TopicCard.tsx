import { useState, useEffect } from 'react'
import { API_URL } from '../constants'
import type { Topic } from '../types'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../services/supabase'

interface TopicCardProps {
  onReady: (topic: Topic) => void
  goalType?: string
  difficulty?: string
  /** When true, renders only the refresh button (embedded inside a parent card) */
  embedded?: boolean
}

export function TopicCard({ onReady, goalType, difficulty, embedded = false }: TopicCardProps) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTopic = async (currentTopicId?: string) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const params = new URLSearchParams()
      if (currentTopicId) params.set('exclude', currentTopicId)
      if (goalType)        params.set('goal', goalType)
      if (difficulty)      params.set('difficulty', difficulty)

      const urlStr = `${API_URL}/sessions/topic${params.toString() ? '?' + params.toString() : ''}`

      const res = await fetch(urlStr, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      })
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
  }, [goalType, difficulty]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Embedded mode: just the refresh button (topic text shown by parent) ──
  if (embedded) {
    return (
      <button
        onClick={() => { setRefreshing(true); fetchTopic(topic?.id) }}
        disabled={refreshing || loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-hover)] border border-[var(--border)] transition-all duration-200 active:scale-[0.97] hover:bg-[var(--bg-card-hover)]"
      >
        <RefreshCw size={14} className={refreshing || loading ? 'animate-spin' : ''} />
        ✨ Generate New Challenge
      </button>
    )
  }

  // ── Standalone mode: full card ──
  if (loading && !refreshing) {
    return (
      <div className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] p-8 flex items-center justify-center min-h-[180px] shadow-sm">
        <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-md)] border-t-[var(--accent)] animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="w-full relative group">
      <div className="w-full relative z-10 bg-[var(--bg-card)] border-2 border-[var(--border)] rounded-[24px] p-8 md:p-10 text-center shadow-md transition-transform duration-300">

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Today's Topic</span>
        </div>

        <h2 className="text-[22px] md:text-[28px] font-medium text-primary leading-snug mb-8">
          {topic?.text || 'Discuss a time when you had to make a difficult decision.'}
        </h2>

        {topic?.goal_type && topic.goal_type !== 'general' && (
          <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {topic.goal_type} · {topic.difficulty}
            </span>
          </div>
        )}

        <button
          onClick={() => { setRefreshing(true); fetchTopic(topic?.id) }}
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
