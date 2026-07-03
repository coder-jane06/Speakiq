import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { API_URL, ROUTES } from '../constants'

/* ================================================================== */
export default function OnboardingPage() {
  const navigate        = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        const res = await fetch(`${API_URL}/dashboard/profile-status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.onboarding_complete) {
            navigate(ROUTES.DASHBOARD, { replace: true })
          }
        }
      } catch {
        // ignore err
      }
    }
    checkStatus()
  }, [navigate])

  /* ── Save name & mark onboarding complete ── */
  const handleFinish = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${API_URL}/dashboard/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          speaking_goal: 'general',      // default; user picks per-session
          display_name: displayName.trim() || null,
          difficulty_tier: 'beginner',   // default; user picks per-session
          recording_duration_secs: 60,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? `Server error ${res.status}`)
      }

      navigate(ROUTES.SESSION, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save your name. Please try again.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  /* ================================================================ */
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'var(--accent)', opacity: 0.04, filter: 'blur(120px)' }}
      />

      <div className="relative z-10 w-full max-w-[480px] flex flex-col items-center text-center animate-fadeSlideUp">

        {/* Icon */}
        <div
          className="w-20 h-20 rounded-[24px] overflow-hidden flex items-center justify-center mb-8 bg-white"
          style={{
            boxShadow: '0 0 40px var(--accent-glow)',
          }}
        >
          <img 
            src="/logo.png" 
            alt="Fluently logo" 
            className="w-full h-full object-cover" 
            style={{ objectPosition: 'center top', transform: 'scale(1.35) translateY(1.5px)' }} 
          />
        </div>

        <h1
          className="text-[36px] md:text-[42px] font-[700] tracking-[-0.03em] mb-4 leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
        >
          Welcome to Fluently
        </h1>
        <p className="text-[17px] font-medium mb-10 max-w-[380px] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Your AI speech coach that adapts to you.
          <br />
          Just tell us your name and you're ready to go.
        </p>

        {/* Name input */}
        <div className="w-full mb-8 text-left">
          <label
            className="text-xs font-bold uppercase tracking-wider mb-2 block"
            style={{ color: 'var(--text-tertiary)' }}
          >
            What should we call you?
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleFinish()}
            placeholder="Your name (optional)"
            className="w-full rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {saveError && (
          <p className="text-red-400 text-[13px] font-medium mb-4">{saveError}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleFinish}
          disabled={saving}
          className="w-full py-4 rounded-[16px] font-bold text-[16px] transition-all active:scale-[0.97] disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            boxShadow: '0 0 32px var(--accent-glow)',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {saving ? 'Setting up…' : "Let's go →"}
        </button>

        <p className="mt-4 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          You can always change your name in Profile settings.
        </p>
      </div>
    </main>
  )
}
