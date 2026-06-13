import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../constants'
import { supabase } from '../services/supabase'
import { Sparkles, CheckCircle2 } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate(ROUTES.DASHBOARD, { replace: true })
    }
  }, [user, navigate])

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp(email, password)
        setSuccessMsg('Check your email to confirm your account.')
      } else {
        await signIn(email, password)
        navigate(ROUTES.DASHBOARD, { replace: true })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setSuccessMsg(null)
  }

  return (
    <main className="min-h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── LEFT PANEL ───────────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Glow blob — top-right corner */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: 'rgba(200,249,125,0.06)',
            filter: 'blur(100px)',
          }}
        />
        {/* Glow blob — bottom-left corner */}
        <div
          className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'rgba(200,249,125,0.04)',
            filter: 'blur(80px)',
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[11px] flex items-center justify-center"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 20px rgba(200,249,125,0.25)',
              }}
            >
              <Sparkles size={18} strokeWidth={2.5} style={{ color: 'var(--bg-base)' }} />
            </div>
            <span
              className="text-[19px] font-bold"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              SpeakIQ
            </span>
          </div>
        </div>

        {/* Middle — Headline + waveform */}
        <div className="relative z-10 flex flex-col gap-8">
          <h2
            className="leading-[1.08]"
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 'clamp(36px, 3.5vw, 48px)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.04em',
            }}
          >
            Your voice,<br />
            <span style={{ color: 'var(--accent)' }}>perfected.</span>
          </h2>

          {/* Mini waveform — 6 bars */}
          <div className="flex items-end gap-1.5 h-[44px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="wave-bar w-2.5 rounded-full"
                style={{ background: 'rgba(200,249,125,0.7)' }}
              />
            ))}
          </div>
        </div>

        {/* Bottom — Feature bullets */}
        <div className="relative z-10 flex flex-col gap-3">
          {[
            'AI-powered speech analysis',
            'Personalized daily drills',
            'Daily progress tracking',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <CheckCircle2
                size={16}
                strokeWidth={2.5}
                style={{ color: 'var(--accent)', flexShrink: 0 }}
              />
              <span
                className="text-[14px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — form ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 relative">

        {/* Subtle ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'rgba(200,249,125,0.03)',
            filter: 'blur(100px)',
          }}
        />

        <div className="relative z-10 w-full max-w-[420px] animate-fadeSlideUp">

          {/* Mobile logo (shown only on small screens) */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <Sparkles size={16} strokeWidth={2.5} style={{ color: 'var(--bg-base)' }} />
            </div>
            <span
              className="text-[17px] font-bold"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
              }}
            >
              SpeakIQ
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1
              className="text-[28px] font-bold mb-1.5"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'signin'
                ? 'Sign in to continue your practice.'
                : 'Join thousands improving their speech daily.'}
            </p>
          </div>

          {/* Mode tabs — pill switcher */}
          <div
            className="flex p-1 rounded-2xl mb-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              className="flex-1 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-200"
              style={{
                background: mode === 'signin' ? 'var(--accent)' : 'transparent',
                color: mode === 'signin' ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              className="flex-1 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-200"
              style={{
                background: mode === 'signup' ? 'var(--accent)' : 'transparent',
                color: mode === 'signup' ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-all duration-200"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200,249,125,0.08)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                required
                minLength={6}
                className="w-full rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-all duration-200"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200,249,125,0.08)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Forgot password */}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError('Enter your email first, then click Forgot password.'); return }
                  setError(null); setLoading(true)
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/login`
                    })
                    if (error) throw error
                    setSuccessMsg('Password reset link sent! Check your email.')
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Failed to send reset email.')
                  } finally { setLoading(false) }
                }}
                className="self-end text-[13px] font-semibold -mt-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                Forgot password?
              </button>
            )}

            {/* Error message */}
            {error && (
              <div
                className="flex items-start gap-2 rounded-[14px] p-3.5 text-[13px] font-medium"
                style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.18)',
                  color: 'var(--red)',
                }}
              >
                <span className="mt-px">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {successMsg && (
              <div
                className="flex items-start gap-2 rounded-[14px] p-3.5 text-[13px] font-medium"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--border-accent)',
                  color: 'var(--accent)',
                }}
              >
                <span className="mt-px">✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold transition-all duration-200 mt-1 active:scale-[0.98]"
              style={{
                background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                color: loading ? 'var(--text-secondary)' : 'var(--bg-base)',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 0 24px rgba(200,249,125,0.18)',
              }}
              onMouseEnter={e => {
                if (!loading) e.currentTarget.style.boxShadow = '0 0 36px rgba(200,249,125,0.28)'
              }}
              onMouseLeave={e => {
                if (!loading) e.currentTarget.style.boxShadow = '0 0 24px rgba(200,249,125,0.18)'
              }}
            >
              {loading
                ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>

          {/* Footer toggle */}
          <p
            className="text-center text-[13px] font-medium mt-7"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="font-bold transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

        </div>
      </div>

    </main>
  )
}
