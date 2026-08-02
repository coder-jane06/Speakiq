import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../constants'
import { supabase } from '../services/supabase'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { signIn, signUp, resendVerification, user } = useAuth()
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
  const [verificationPending, setVerificationPending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUp(email, password)
        setVerificationPending(needsEmailConfirmation)
        setSuccessMsg(needsEmailConfirmation
          ? 'We sent a verification link. Open it in this browser to finish signing in.'
          : 'Account created. You are signed in.')
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
    setVerificationPending(false)
  }

  return (
    <main className="min-h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── LEFT PANEL ───────────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-10 relative overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Animated gradient blobs for depth */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(62,140,0,0.08) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(62,140,0,0.06) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Fluently logo" 
              className="w-14 h-14 object-contain flex-shrink-0" 
            />
            <span
              className="text-[22px] font-black bg-gradient-to-r from-[var(--gradient-hero-from)] to-[var(--gradient-hero-to)] bg-clip-text text-transparent"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              Fluently
            </span>
          </div>
        </div>

        {/* Middle — Enlarged headline + waveform */}
        <div className="relative z-10 flex flex-col gap-8 flex-1 flex items-center justify-center">
          {/* Hero Headline */}
          <div className="text-center max-w-md">
            <h2
              className="leading-[1.08]"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 'clamp(52px, 5vw, 72px)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              Your voice,<br />
              <span style={{ color: 'var(--accent)' }}>perfected.</span>
            </h2>
          </div>

          {/* Animated waveform bars */}
          <div className="flex items-end justify-center gap-2 h-[100px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-3 rounded-full"
                style={{
                  background: 'var(--accent)',
                  animation: `waveAnimation 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  minHeight: '8px',
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes waveAnimation {
              0%, 100% {
                height: 20px;
                opacity: 0.6;
              }
              50% {
                height: 80px;
                opacity: 1;
              }
            }
          `}</style>
        </div>

        {/* Bottom — Premium Feature Cards */}
        <div className="relative z-10 grid grid-cols-1 gap-2.5">
          {[
            {
              title: 'AI-Powered\nSpeech Analysis',
              desc: 'Get detailed feedback on clarity, pace, tone, and confidence.',
              icon: '🎯',
              gradient: 'rgba(208, 255, 214, 0.6)',
              border: 'rgba(62,140,0,0.2)',
            },
            {
              title: 'Personalized\nDaily Drills',
              desc: 'Practice with custom exercises designed just for you.',
              icon: '🎪',
              gradient: 'rgba(232, 216, 255, 0.6)',
              border: 'rgba(139, 92, 246, 0.2)',
            },
            {
              title: 'Daily Progress\nTracking',
              desc: 'Track your improvement and celebrate every win.',
              icon: '📈',
              gradient: 'rgba(217, 232, 255, 0.6)',
              border: 'rgba(37, 99, 235, 0.2)',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-[14px] p-3.5 border backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
              style={{
                background: feature.gradient,
                borderColor: feature.border,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.5)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[16px]">{feature.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-[12px] font-bold leading-tight whitespace-pre-line"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {feature.desc}
                  </p>
                </div>
              </div>
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
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Fluently logo" 
              className="w-14 h-14 object-contain flex-shrink-0" 
            />
            <span
              className="text-[20px] font-black bg-gradient-to-r from-[var(--gradient-hero-from)] to-[var(--gradient-hero-to)] bg-clip-text text-transparent"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              Fluently
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
              className="flex-1 py-3 rounded-[14px] text-[13px] font-bold transition-all duration-200"
              style={{
                background: mode === 'signin' ? 'var(--accent)' : 'transparent',
                color: mode === 'signin' ? 'var(--accent-text)' : 'var(--text-secondary)',
              }}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              className="flex-1 py-3 rounded-[14px] text-[13px] font-bold transition-all duration-200"
              style={{
                background: mode === 'signup' ? 'var(--accent)' : 'transparent',
                color: mode === 'signup' ? 'var(--accent-text)' : 'var(--text-secondary)',
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
                className="w-full rounded-[14px] px-4 py-3.5 text-[14px] font-medium outline-none transition-all duration-200"
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
                className="w-full rounded-[14px] px-4 py-3.5 text-[14px] font-medium outline-none transition-all duration-200"
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
                className="self-end text-[13px] font-semibold -mt-1 px-1 py-2 transition-opacity hover:opacity-70"
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

            {mode === 'signup' && verificationPending && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null)
                  setLoading(true)
                  try {
                    await resendVerification(email)
                    setSuccessMsg('A fresh verification link has been sent. Check spam or promotions too.')
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Unable to resend the verification email.')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="self-center text-[13px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                Resend verification email
              </button>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold transition-all duration-200 mt-1 active:scale-[0.98]"
              style={{
                background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                color: loading ? 'var(--text-secondary)' : 'var(--accent-text)',
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
