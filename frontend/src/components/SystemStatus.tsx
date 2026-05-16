import { useEffect, useState } from 'react'
import { API_URL } from '../constants'

type Status = 'checking' | 'connected' | 'disconnected'

export function SystemStatus() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(4000) })
        if (!cancelled) setStatus(res.ok ? 'connected' : 'disconnected')
      } catch {
        if (!cancelled) setStatus('disconnected')
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (status === 'checking') return null

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-[#111] border border-[#222] rounded-full px-3 py-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'connected' ? 'bg-[#C8F97D]' : 'bg-red-400'
        }`}
      />
      <span className="text-[10px] font-mono text-[#555]">
        {status === 'connected' ? 'API connected' : 'API offline'}
      </span>
    </div>
  )
}
