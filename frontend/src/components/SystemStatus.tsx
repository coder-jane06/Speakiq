import { useEffect, useState } from 'react'
import { API_URL } from '../constants'

type ConnectionState = 'checking' | 'connected' | 'disconnected'

interface SystemStatusResponse {
  api: { status: ConnectionState }
  supabase: {
    status: ConnectionState
    topics_count: number | null
    detail: string | null
  }
}

import { useTheme } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button 
      onClick={toggleTheme}
      style={{
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        border: '1px solid var(--bg-card-border-light)',
        borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        marginBottom: 8
      }}
    >
      {theme === 'dark' ? <><Sun size={14} /> Light Mode</> : <><Moon size={14} /> Dark Mode</>}
    </button>
  )
}


export function SystemStatus() {
  const [apiStatus, setApiStatus] = useState<ConnectionState>('checking')
  const [supabaseStatus, setSupabaseStatus] = useState<ConnectionState>('checking')

  useEffect(() => {
    let cancelled = false
    let failureCount = 0

    async function check() {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)

      try {
        const res = await fetch(`${API_URL}/system/status`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`)

        const data = (await res.json()) as SystemStatusResponse
        if (!cancelled) {
          failureCount = 0
          setApiStatus(data.api.status)
          setSupabaseStatus(data.supabase.status)
        }
      } catch {
        if (!cancelled) {
          failureCount++
          if (failureCount >= 3) {
            setApiStatus('disconnected')
            setSupabaseStatus('disconnected')
          }
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    check()
    const interval = window.setInterval(check, 10000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  if (apiStatus === 'checking' && supabaseStatus === 'checking') return null

  const connected = apiStatus === 'connected' && supabaseStatus === 'connected'

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      background: 'var(--bg-card)',
      border: '1px solid var(--bg-card-border-light)',
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      <ThemeToggle />
      <StatusRow label="API" status={apiStatus} />
      <StatusRow label="Supabase" status={supabaseStatus} />
      <span style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}>
        {connected ? 'API and Supabase connected' : 'Connection issue detected'}
      </span>
    </div>
  )
}

function StatusRow({ label, status }: { label: string; status: ConnectionState }) {
  const isConnected = status === 'connected'
  const color = isConnected ? 'var(--accent)' : '#F87171'
  const text = status === 'checking' ? 'checking' : isConnected ? 'connected' : 'offline'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
      }} />
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#777' }}>
        {label} {text}
      </span>
    </div>
  )
}
