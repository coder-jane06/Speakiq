import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { API_URL, ROUTES } from '../constants'
import {
  Mic, Sparkles, Swords, BarChart3, Briefcase,
  ChevronRight, ChevronLeft,
} from 'lucide-react'

/* ── Goal cards ── */
const GOALS = [
  {
    id: 'orator',
    icon: <Mic size={28} strokeWidth={2} />,
    title: 'Orator',
    description: 'Command a room. Powerful speeches, storytelling, and presence.',
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
  },
  {
    id: 'debater',
    icon: <Swords size={28} strokeWidth={2} />,
    title: 'Debater',
    description: 'Win arguments. Quick thinking, rebuttals, and logical structure.',
    color: 'var(--blue)',
    bg: 'rgba(96,165,250,0.12)',
  },
  {
    id: 'presenter',
    icon: <BarChart3 size={28} strokeWidth={2} />,
    title: 'Presenter',
    description: 'Ace your pitch. Clear, concise, and data-driven delivery.',
    color: 'var(--amber)',
    bg: 'rgba(251,191,36,0.12)',
  },
  {
    id: 'interviewer',
    icon: <Briefcase size={28} strokeWidth={2} />,
    title: 'Interviewer',
    description: 'Land the job. Confident, structured, articulate answers.',
    color: 'var(--teal)',
    bg: 'rgba(45,212,191,0.12)',
  },
]

/* ── Level options ── */
const LEVELS = [
  { id: 'beginner',     label: 'Beginner',     desc: "I'm just starting out",      duration: 60  },
  { id: 'intermediate', label: 'Intermediate', desc: 'I have some experience',      duration: 90  },
  { id: 'advanced',     label: 'Advanced',     desc: 'I want to refine my skills',  duration: 120 },
]

/* ================================================================== */
export default function OnboardingPage() {
  const navigate     = useNavigate()
  const [step, setStep]             = useState(0)
  const [goal, setGoal]             = useState('')
  const [level, setLevel]           = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving]         = useState(false)

  const canProceed =
    step === 0 ||
    (step === 1 && !!goal) ||
    (step === 2 && !!level) ||
    step === 3

  /* ── Save & navigate ── */
  const handleFinish = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const selectedLevel = LEVELS.find(l => l.id === level)

      await fetch(`${API_URL}/dashboard/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          speaking_goal: goal,
          display_name: displayName || null,
          difficulty_tier: level,
          recording_duration_secs: selectedLevel?.duration || 60,
        }),
      })

      navigate(ROUTES.SESSION, { replace: true })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      navigate(ROUTES.SESSION, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  /* ================================================================ */
  return (
    <main className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Progress dots */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`rounded-full transition-all duration-500 ${
              i === step
                ? 'w-8 h-2 bg-[var(--accent)]'
                : i < step
                  ? 'w-2 h-2 bg-[var(--accent)]/50'
                  : 'w-2 h-2 bg-[var(--border-md)]'
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-[520px]">

        {/* ─── Step 0 · Welcome ─── */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center animate-fadeSlideUp">
            <div className="w-20 h-20 rounded-[24px] bg-[var(--accent)] text-[var(--bg-base)] flex items-center justify-center shadow-[0_0_40px_var(--accent-glow)] mb-8">
              <Sparkles size={36} strokeWidth={2} />
            </div>
            <h1 className="text-[36px] md:text-[42px] font-[700] text-primary tracking-[-0.03em] mb-4 leading-tight">
              Welcome to SpeakIQ
            </h1>
            <p className="text-secondary text-[17px] font-medium mb-4 max-w-[400px] leading-relaxed">
              Your AI speech coach that adapts to you.
              <br />
              Let's personalize your journey in 30 seconds.
            </p>

            <div className="w-full mt-6">
              <label className="text-xs font-bold text-tertiary uppercase tracking-wider mb-2 block text-left">
                What should we call you?
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-primary font-medium focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all outline-none"
              />
            </div>
          </div>
        )}

        {/* ─── Step 1 · Speaking Goal ─── */}
        {step === 1 && (
          <div className="flex flex-col animate-fadeSlideUp">
            <h2 className="text-[28px] md:text-[34px] font-[700] text-primary tracking-[-0.02em] mb-3 text-center">
              What do you want to master?
            </h2>
            <p className="text-secondary text-[16px] font-medium mb-8 text-center">
              This shapes your topics, drills, and AI feedback.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`flex items-start gap-4 p-5 rounded-[20px] border-2 transition-all duration-300 text-left group ${
                    goal === g.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] scale-[1.02] shadow-lg'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-md)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: goal === g.id ? g.bg : 'var(--bg-hover)',
                      color: goal === g.id ? g.color : 'var(--text-tertiary)',
                    }}
                  >
                    {g.icon}
                  </div>
                  <div>
                    <h3
                      className={`text-[16px] font-bold mb-1 transition-colors ${
                        goal === g.id ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      {g.title}
                    </h3>
                    <p className="text-[13px] text-tertiary font-medium leading-snug">
                      {g.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 2 · Level ─── */}
        {step === 2 && (
          <div className="flex flex-col items-center animate-fadeSlideUp">
            <h2 className="text-[28px] md:text-[34px] font-[700] text-primary tracking-[-0.02em] mb-3 text-center">
              How experienced are you?
            </h2>
            <p className="text-secondary text-[16px] font-medium mb-8 text-center">
              This adjusts your session length and topic difficulty.
            </p>

            <div className="w-full grid grid-cols-1 gap-3">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={`flex items-center justify-between p-5 rounded-[20px] border-2 transition-all duration-300 ${
                    level === l.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] scale-[1.02] shadow-lg'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-md)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="text-left">
                    <h3
                      className={`text-[16px] font-bold mb-0.5 ${
                        level === l.id ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      {l.label}
                    </h3>
                    <p className="text-[13px] text-tertiary font-medium">{l.desc}</p>
                  </div>
                  <div
                    className={`text-[14px] font-bold font-mono px-3 py-1 rounded-lg border ${
                      level === l.id
                        ? 'text-[var(--accent)] bg-[var(--accent-dim)] border-[var(--border-accent)]'
                        : 'text-tertiary bg-[var(--bg-hover)] border-[var(--border)]'
                    }`}
                  >
                    {l.duration}s
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 3 · Ready ─── */}
        {step === 3 && (
          <div className="flex flex-col items-center text-center animate-fadeSlideUp">
            <div className="w-20 h-20 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center mb-8 animate-pulse">
              <Mic size={36} strokeWidth={2} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-[32px] md:text-[38px] font-[700] text-primary tracking-[-0.03em] mb-4 leading-tight">
              You're all set{displayName ? `, ${displayName}` : ''}!
            </h2>
            <p className="text-secondary text-[17px] font-medium mb-2 max-w-[400px] leading-relaxed">
              Your AI coach is now personalized for{' '}
              <span className="text-[var(--accent)] font-bold">
                {GOALS.find(g => g.id === goal)?.title || 'speaking'}
              </span>{' '}
              at the{' '}
              <span className="font-bold text-primary">
                {LEVELS.find(l => l.id === level)?.label || ''}
              </span>{' '}
              level.
            </p>
            <p className="text-tertiary text-[15px] font-medium mb-6">
              Every session adapts to your progress.
            </p>
          </div>
        )}

        {/* ─── Navigation Buttons ─── */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 text-secondary font-medium text-[14px] hover:text-primary transition-colors px-4 py-2.5 rounded-xl hover:bg-[var(--bg-hover)]"
            >
              <ChevronLeft size={18} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed}
              className={`flex items-center gap-1 px-8 py-3.5 rounded-[16px] font-bold text-[15px] transition-all active:scale-[0.97] ${
                canProceed
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:scale-[1.02] shadow-lg'
                  : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] cursor-not-allowed border border-[var(--border)]'
              }`}
            >
              Continue <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-10 py-4 rounded-[16px] font-bold text-[16px] bg-[var(--accent)] text-[var(--bg-base)] hover:scale-[1.02] active:scale-[0.97] shadow-[0_0_30px_var(--accent-glow)] transition-all"
            >
              {saving ? 'Setting up…' : 'Start First Session'}
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
