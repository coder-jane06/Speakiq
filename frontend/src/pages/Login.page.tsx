import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../constants'
import { Sparkles } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

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

  return (
    <main className="min-h-screen bg-primary flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[420px] bg-[var(--bg-card)] border border-[var(--border)] rounded-[32px] p-10 shadow-2xl animate-fadeSlideUp">
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-[var(--accent)] text-[var(--bg-base)] flex items-center justify-center shadow-[0_0_30px_var(--accent-glow)] mb-5">
            <Sparkles size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight mb-1">SpeakIQ</h1>
          <p className="text-secondary font-medium">Your AI speech coach</p>
        </div>

        {/* Mode toggle */}
        <div className="flex p-1 bg-primary border border-[var(--border)] rounded-2xl mb-8">
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'signin' ? 'bg-[var(--accent)] text-[var(--bg-base)] shadow-sm' : 'text-secondary hover:text-primary'
            }`}
            onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null) }}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'signup' ? 'bg-[var(--accent)] text-[var(--bg-base)] shadow-sm' : 'text-secondary hover:text-primary'
            }`}
            onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null) }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-tertiary uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-primary border border-[var(--border)] rounded-xl px-4 py-3 text-primary font-medium focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-tertiary uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
              required
              minLength={6}
              className="w-full bg-primary border border-[var(--border)] rounded-xl px-4 py-3 text-primary font-medium focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all outline-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[var(--red)] text-sm font-medium">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-xl p-3 text-[var(--accent)] text-sm font-medium">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className={`w-full py-4 mt-2 rounded-[16px] text-base font-bold transition-all shadow-lg active:scale-[0.98] ${
              loading ? 'bg-[var(--accent-dim)] text-[var(--text-secondary)] cursor-not-allowed' : 'bg-[var(--accent)] text-[var(--bg-base)] hover:brightness-110 hover:shadow-xl'
            }`}
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-center text-sm font-medium text-tertiary mt-8">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-[var(--accent)] font-bold hover:underline"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccessMsg(null) }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  )
}
