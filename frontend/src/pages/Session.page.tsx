import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionFlow }  from '../hooks/useSessionFlow'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { AudioWaveform } from '../components/AudioRecorder'
import { ROUTES } from '../constants'
import { TopicCard } from '../components/TopicCard'
import type { Topic } from '../types'
import { ArrowLeft, ChevronRight, Sparkles, Mic, Trophy, Target, Zap, TrendingUp, Sliders, Pause, Play, MicOff, Activity, Volume2, CheckCircle, AlertTriangle } from 'lucide-react'

/* ── Goal cards ── */
const GOALS = [
  {
    id: 'orator',
    emoji: '🎤',
    title: 'Orator',
    badge: 'Most Popular',
    badgeColor: 'rgba(62,140,0,0.12)',
    badgeText: '#3E8C00',
    description: 'Command a room. Powerful speeches, storytelling, and presence.',
    skills: ['Storytelling', 'Stage Presence', 'Confidence'],
    skillColor: '#3E8C00',
    skillBg: 'rgba(62,140,0,0.08)',
    borderSelected: '#3E8C00',
    bgSelected: 'rgba(62,140,0,0.05)',
  },
  {
    id: 'debater',
    emoji: '⚔️',
    title: 'Debater',
    badge: 'Career Growth',
    badgeColor: 'rgba(139,92,246,0.1)',
    badgeText: '#7C3AED',
    description: 'Win arguments. Quick thinking, rebuttals, and logical structure.',
    skills: ['Critical Thinking', 'Rebuttal Skills', 'Persuasion'],
    skillColor: '#7C3AED',
    skillBg: 'rgba(139,92,246,0.08)',
    borderSelected: '#7C3AED',
    bgSelected: 'rgba(139,92,246,0.05)',
  },
  {
    id: 'presenter',
    emoji: '📊',
    title: 'Presenter',
    badge: 'Recommended',
    badgeColor: 'rgba(37,99,235,0.1)',
    badgeText: '#2563EB',
    description: 'Ace your pitch. Clear, concise, and data-driven delivery.',
    skills: ['Business Communication', 'Pitch Perfect', 'Clarity'],
    skillColor: '#2563EB',
    skillBg: 'rgba(37,99,235,0.08)',
    borderSelected: '#2563EB',
    bgSelected: 'rgba(37,99,235,0.05)',
  },
  {
    id: 'interviewer',
    emoji: '💼',
    title: 'Interviewer',
    badge: '',
    badgeColor: '',
    badgeText: '',
    description: 'Land the job. Confident, structured, articulate answers.',
    skills: ['Structured Answers', 'Confidence', 'Impact'],
    skillColor: '#D97706',
    skillBg: 'rgba(217,119,6,0.08)',
    borderSelected: '#D97706',
    bgSelected: 'rgba(217,119,6,0.05)',
  },
]

/* ── Level options ── */
const LEVELS = [
  {
    id: 'beginner',
    emoji: '🌱',
    label: 'Beginner',
    badge: 'Start Here',
    badgeColor: 'rgba(62,140,0,0.12)',
    badgeText: '#3E8C00',
    desc: "I'm just starting out",
    detail: 'Short focused sessions to build your foundation.',
    skillColor: '#3E8C00',
    skillBg: 'rgba(62,140,0,0.08)',
    borderSelected: '#3E8C00',
    bgSelected: 'rgba(62,140,0,0.05)',
    duration: 60,
  },
  {
    id: 'intermediate',
    emoji: '💪',
    label: 'Intermediate',
    badge: 'Most Common',
    badgeColor: 'rgba(37,99,235,0.1)',
    badgeText: '#2563EB',
    desc: 'I have some experience',
    detail: 'Balanced sessions that push your comfort zone.',
    skillColor: '#2563EB',
    skillBg: 'rgba(37,99,235,0.08)',
    borderSelected: '#2563EB',
    bgSelected: 'rgba(37,99,235,0.05)',
    duration: 60,
  },
  {
    id: 'advanced',
    emoji: '🚀',
    label: 'Advanced',
    badge: 'Pro Mode',
    badgeColor: 'rgba(139,92,246,0.1)',
    badgeText: '#7C3AED',
    desc: 'I want to refine my skills',
    detail: 'Challenging topics and extended sessions for mastery.',
    skillColor: '#7C3AED',
    skillBg: 'rgba(139,92,246,0.08)',
    borderSelected: '#7C3AED',
    bgSelected: 'rgba(139,92,246,0.05)',
    duration: 60,
  },
]

export default function SessionPage() {
  const navigate = useNavigate()
  const flow     = useSessionFlow()
  const recorder = useAudioRecorder()

  // 'setup-goal' → 'setup-level' → 'setup-complete' → flow states (idle, prep, recording...)
  const [setupStep, setSetupStep] = useState<'setup-goal' | 'setup-level' | 'setup-complete' | 'session'>('setup-goal')
  const [selectedGoal, setSelectedGoal] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)

  const tips = [
    '💡 Maintain strong pacing and clear pronunciation.',
    '💡 Finish your complete thought before pausing.',
    '💡 Focus on your breathing and stay relaxed.',
    '💡 Use intentional pauses to emphasize key points.',
  ]

  useEffect(() => {
    if (flow.state === 'recording') {
      const interval = setInterval(() => {
        setTipIndex(prev => (prev + 1) % 4)
      }, 4000)
      return () => clearInterval(interval)
    }
  }, [flow.state])

  useEffect(() => {
    if (flow.state === 'recording' && !recorder.isRecording) {
      recorder.startRecording()
      flow.startRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.state])

  useEffect(() => {
    if (flow.recSecsLeft === 0 && recorder.isRecording) {
      recorder.stopRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.recSecsLeft])

  useEffect(() => {
    if (recorder.audioBlob && flow.state === 'recording') {
      flow.finishRecording(recorder.audioBlob)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob])

  useEffect(() => {
    if (flow.state === 'analyzing' && flow.sessionId) {
      navigate(`/session/${flow.sessionId}/results`)
    }
  }, [flow.state, flow.sessionId])

  // Back: go back through setup steps or home
  const handleBack = () => {
    if (setupStep === 'setup-level') { setSetupStep('setup-goal'); return }
    if (setupStep === 'setup-complete') { setSetupStep('setup-level'); return }
    if (setupStep === 'session') {
      if (flow.state === 'recording') {
        if (recorder.isRecording) recorder.stopRecording()
        flow.reset()
        setSetupStep('setup-complete')
        return
      }
      setSetupStep('setup-complete');
      return
    }
    navigate(ROUTES.HOME)
  }

  const isSetupGoal     = setupStep === 'setup-goal'
  const isSetupLevel    = setupStep === 'setup-level'
  const isSetupComplete = setupStep === 'setup-complete'
  const isIdle          = setupStep === 'session' && flow.state === 'idle'
  const isPrep          = setupStep === 'session' && flow.state === 'prep'
  const isRecording     = setupStep === 'session' && flow.state === 'recording'
  const isUploading     = setupStep === 'session' && (flow.state === 'uploading' || flow.state === 'analyzing')
  const isError         = setupStep === 'session' && flow.state === 'error'

  const currentGoalObj  = GOALS.find(g => g.id === selectedGoal) || GOALS[0]
  const currentLevelObj = LEVELS.find(l => l.id === selectedLevel) || LEVELS[0]

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Ambient recording glow — only when recording */}
      {isRecording && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
          style={{
            background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(163,230,53,0.05) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Subtle static noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      <div className="w-full max-w-[680px] flex-1 flex flex-col pt-4 relative z-10">

        {/* Back button */}
        {(isSetupGoal || isSetupLevel || isSetupComplete || isIdle || isPrep || isRecording || isError) && (
          <button
            onClick={handleBack}
            className="self-start flex items-center gap-2 mb-6 px-3 py-2 -ml-2 rounded-xl transition-all duration-200"
            style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="text-[13px] font-semibold tracking-wide">
              {isSetupGoal ? 'Cancel' : 'Back'}
            </span>
          </button>
        )}

        {/* ── SETUP: Goal Selection ── */}
        {isSetupGoal && (
          <div className="flex-1 flex flex-col animate-fadeSlideUp w-full">
            <h1
              className="text-[32px] lg:text-[38px] font-[800] mb-2 tracking-[-0.025em] text-center"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--text-primary)' }}
            >
              What do you want to master?
            </h1>
            <p className="text-[15px] font-medium mb-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              This shapes your topics, drills, and AI feedback.
            </p>

            <div className="grid grid-cols-1 gap-3 w-full mb-8">
              {GOALS.map(g => {
                const isSelected = selectedGoal === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGoal(g.id)}
                    className="relative flex items-start gap-4 p-5 rounded-[18px] border transition-all duration-200 text-left w-full"
                    style={{
                      borderColor: isSelected ? g.borderSelected : 'var(--border)',
                      borderWidth: isSelected ? '2px' : '1px',
                      background: isSelected ? g.bgSelected : 'var(--bg-card)',
                      boxShadow: isSelected ? `0 0 0 4px ${g.bgSelected}` : 'none',
                      transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                    }}
                  >
                    {/* Badge */}
                    {g.badge && (
                      <span
                        className="absolute top-4 right-4 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: g.badgeColor, color: g.badgeText }}
                      >
                        {g.badge}
                      </span>
                    )}
                    {/* Emoji icon */}
                    <div
                      className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 text-[22px]"
                      style={{
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {g.emoji}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0 pr-16">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
                          {g.title}
                        </h3>
                        {isSelected && (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                            style={{ background: g.borderSelected }}
                          >✓</span>
                        )}
                      </div>
                      <p className="text-[13px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                        {g.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.skills.map(s => (
                          <span
                            key={s}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: g.skillColor,
                              background: g.skillBg,
                            }}
                          >
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              disabled={!selectedGoal}
              onClick={() => setSetupStep('setup-level')}
              className="w-full py-4 text-[16px] font-bold rounded-full transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
              style={selectedGoal ? {
                background: 'var(--accent)', color: '#09090F', boxShadow: '0 0 32px var(--accent-glow)',
              } : {
                background: 'var(--bg-card)', color: 'var(--text-tertiary)',
                cursor: 'not-allowed', border: '1px solid var(--border)',
              }}
            >
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── SETUP: Level Selection ── */}
        {isSetupLevel && (
          <div className="flex-1 flex flex-col animate-fadeSlideUp w-full">
            <h1
              className="text-[32px] lg:text-[38px] font-[800] mb-2 tracking-[-0.025em] text-center"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--text-primary)' }}
            >
              How experienced are you?
            </h1>
            <p className="text-[15px] font-medium mb-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              This sets your session length and topic difficulty.
            </p>

            <div className="grid grid-cols-1 gap-3 w-full mb-8">
              {LEVELS.map(l => {
                const isSel = selectedLevel === l.id
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLevel(l.id)}
                    className="relative flex items-start gap-4 p-5 rounded-[18px] border transition-all duration-200 text-left w-full"
                    style={{
                      borderColor: isSel ? l.borderSelected : 'var(--border)',
                      borderWidth: isSel ? '2px' : '1px',
                      background: isSel ? l.bgSelected : 'var(--bg-card)',
                      boxShadow: isSel ? `0 0 0 4px ${l.bgSelected}` : 'none',
                      transform: isSel ? 'scale(1.01)' : 'scale(1)',
                    }}
                  >
                    {/* Duration badge — top right */}
                    <span
                      className="absolute top-4 right-4 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: l.badgeColor, color: l.badgeText }}
                    >
                      {l.badge}
                    </span>

                    {/* Emoji icon */}
                    <div
                      className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 text-[22px]"
                      style={{
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {l.emoji}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0 pr-20">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
                          {l.label}
                        </h3>
                        {isSel && (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                            style={{ background: l.borderSelected }}
                          >✓</span>
                        )}
                        <span
                          className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md"
                          style={{
                            color: isSel ? l.skillColor : 'var(--text-tertiary)',
                            background: isSel ? l.skillBg : 'var(--bg-hover)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {l.duration}s
                        </span>
                      </div>
                      <p className="text-[13px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                        {l.detail}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              disabled={!selectedLevel}
              onClick={() => setSetupStep('setup-complete')}
              className="w-full py-4 text-[16px] font-bold rounded-full transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
              style={selectedLevel ? {
                background: 'var(--accent)', color: '#09090F', boxShadow: '0 0 32px var(--accent-glow)',
              } : {
                background: 'var(--bg-card)', color: 'var(--text-tertiary)',
                cursor: 'not-allowed', border: '1px solid var(--border)',
              }}
            >
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── SETUP: AI Coach Ready / Onboarding Complete ── */}
        {isSetupComplete && (
          <div className="flex-1 flex flex-col items-center animate-fadeSlideUp w-full max-w-[640px] py-2 text-center relative z-10 mx-auto">
            
            {/* Soft green ambient background blobs */}
            <div 
              className="absolute -top-10 left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full pointer-events-none z-0"
              style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.15) 0%, rgba(62,140,0,0) 70%)', filter: 'blur(40px)' }}
            />
            <div 
              className="absolute top-1/3 left-10 w-[200px] h-[200px] rounded-full pointer-events-none z-0"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0) 70%)', filter: 'blur(30px)' }}
            />

            {/* Hero Section: Animated AI Orb & Voice Wave */}
            <div className="relative z-10 mb-5 flex flex-col items-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Glowing pulses */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: '#3E8C00' }} />
                <div className="absolute -inset-3 rounded-full opacity-40 blur-md" style={{ background: 'radial-gradient(circle, #3E8C00 0%, transparent 70%)' }} />
                
                {/* Core AI Orb */}
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center relative shadow-2xl transition-transform hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #3E8C00 0%, #22C55E 50%, #15803D 100%)',
                    boxShadow: '0 0 50px rgba(62,140,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4)',
                  }}
                >
                  {/* Floating particle sparkles */}
                  <Sparkles className="absolute -top-2 -right-2 text-yellow-300 animate-bounce" size={22} />
                  <Mic size={36} className="text-white drop-shadow-md" strokeWidth={2.2} />
                </div>
              </div>

              {/* Waveform animation bars */}
              <div className="flex items-center gap-1.5 mt-3 h-5">
                {[40, 70, 100, 60, 90, 50, 80, 30].map((h, i) => (
                  <span 
                    key={i} 
                    className="w-1 bg-emerald-500 rounded-full animate-pulse"
                    style={{ 
                      height: `${h}%`, 
                      animationDelay: `${i * 0.15}s`,
                      backgroundColor: i % 2 === 0 ? '#3E8C00' : '#22C55E' 
                    }} 
                  />
                ))}
              </div>
            </div>

            {/* Headline */}
            <h1
              className="text-[34px] sm:text-[40px] font-[800] tracking-[-0.03em] leading-tight mb-3 text-[var(--text-primary)] relative z-10"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              Your AI Coach is Ready.
            </h1>

            {/* Subheadline & Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6 relative z-10 text-[14px] font-medium text-[var(--text-secondary)]">
              <span>Built for</span>
              <span 
                className="px-3 py-1 rounded-full text-[13px] font-bold flex items-center gap-1.5 shadow-sm border"
                style={{ background: currentGoalObj.bgSelected, color: currentGoalObj.borderSelected, borderColor: currentGoalObj.borderSelected + '40' }}
              >
                {currentGoalObj.emoji} {currentGoalObj.title} Mastery
              </span>
              <span>• Designed around your</span>
              <span 
                className="px-3 py-1 rounded-full text-[13px] font-bold flex items-center gap-1.5 shadow-sm border"
                style={{ background: currentLevelObj.bgSelected, color: currentLevelObj.borderSelected, borderColor: currentLevelObj.borderSelected + '40' }}
              >
                {currentLevelObj.emoji} {currentLevelObj.label} journey
              </span>
            </div>

            {/* Grid layout for Achievement Card & Dashboard Preview */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10 text-left">
              
              {/* Achievement Card */}
              <div 
                className="p-5 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] shadow-xl backdrop-blur-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Trophy size={16} />
                    </div>
                    <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Session Profile</h3>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)] font-medium flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span> Goal:
                      </span>
                      <span className="font-bold text-[var(--text-primary)]">{currentGoalObj.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)] font-medium flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span> Level:
                      </span>
                      <span className="font-bold text-[var(--text-primary)]">{currentLevelObj.label} ({currentLevelObj.duration}s)</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)] font-medium flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span> Drills Ready:
                      </span>
                      <span className="font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">Personalized</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)] font-medium flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span> AI Feedback:
                      </span>
                      <span className="font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded text-[11px]">Real-Time Active</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-medium">
                  <Zap size={13} className="text-amber-500" /> Adaptive AI engine loaded for this session
                </div>
              </div>

              {/* Dashboard Preview */}
              <div 
                className="p-5 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] shadow-xl backdrop-blur-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Target size={16} />
                      </div>
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Analytics Preview</h3>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded border border-[var(--border)]">LIVE TRACKER</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
                      <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">Speech Score</p>
                      <p className="text-[17px] font-extrabold text-[var(--text-primary)] flex items-baseline gap-1">
                        88 <span className="text-[11px] font-normal text-emerald-500">/ 100</span>
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
                      <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">Confidence</p>
                      <p className="text-[17px] font-extrabold text-emerald-500 flex items-center gap-1">
                        92% <TrendingUp size={13} />
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-[var(--text-primary)]">Daily Challenge</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Unlocked & waiting</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-[var(--text-tertiary)] font-medium flex items-center justify-between">
                  <span>Progress Tracker: Day 1 Streak</span>
                  <span className="text-emerald-500 font-bold">Ready</span>
                </div>
              </div>

            </div>

            {/* Motivation Section */}
            <div className="mb-6 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-200/60 inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-800 relative z-10 shadow-sm">
              <span>💡</span>
              <span>Your first session takes less than 3 minutes and unlocks personalized feedback.</span>
            </div>

            {/* CTA Section */}
            <div className="w-full relative z-10 mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Begin your first AI coaching session
              </p>
              <button
                onClick={() => setSetupStep('session')}
                className="w-full py-4 text-[17px] font-bold rounded-full transition-all duration-300 active:scale-[0.98] text-white shadow-[0_0_30px_rgba(62,140,0,0.35)] hover:shadow-[0_0_45px_rgba(62,140,0,0.5)] flex items-center justify-center gap-2 group"
                style={{ background: '#3E8C00' }}
              >
                <span>Start Session 🎙</span>
                <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center justify-center gap-6 relative z-10 text-[13px] font-bold">
              <button
                onClick={() => navigate(ROUTES.HOME)}
                className="text-gray-500 hover:text-gray-900 transition-colors py-1 px-3 rounded-lg hover:bg-gray-100"
              >
                View Dashboard
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => setSetupStep('setup-goal')}
                className="text-gray-500 hover:text-gray-900 transition-colors py-1 px-3 rounded-lg hover:bg-gray-100 flex items-center gap-1.5"
              >
                <Sliders size={14} /> Edit Preferences
              </button>
            </div>

          </div>
        )}

        {/* ── IDLE: Premium AI Coaching Launchpad ── */}
        {isIdle && (
          <div className="flex-1 flex flex-col items-center animate-fadeSlideUp w-full py-4 relative">

            <div className="text-center mb-8">
              <h1
                className="text-[36px] lg:text-[42px] font-[800] tracking-[-0.03em] leading-tight mb-2 text-[var(--text-primary)]"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                Your Next Challenge Awaits
              </h1>
              <p className="text-[15px] font-medium text-[var(--text-secondary)]">
                Ready to speak with confidence? Let's go.
              </p>
            </div>

            {/* Subtle Poppy Topic Card */}
            <div className="w-full max-w-[680px] bg-[var(--bg-card)] rounded-[24px] p-8 mb-10 relative shadow-xl border border-[var(--border)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-blue-500">
                  <span>✨</span> AI SELECTED CHALLENGE
                </span>
                <div className="flex items-center gap-3">
                  {selectedTopic?.difficulty && (
                    <span className="text-[12px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 capitalize bg-[var(--bg-hover)] text-[var(--text-secondary)] shadow-sm border border-[var(--border)]">
                      🔥 Difficulty: {selectedTopic.difficulty}
                    </span>
                  )}
                  {/* Generate new challenge button */}
                  <TopicCard
                    onReady={setSelectedTopic}
                    goalType={selectedGoal}
                    difficulty={selectedLevel === 'advanced' ? 'hard' : selectedLevel === 'intermediate' ? 'medium' : 'easy'}
                    embedded={true}
                  />
                </div>
              </div>
              
              <h2 className="text-[24px] md:text-[26px] font-bold leading-snug mb-8 text-[var(--text-primary)] px-1 pr-[150px]">
                {selectedTopic?.text || 'Tell me about a time you had to lead without formal authority.'}
              </h2>
              
              <div className="h-px w-full mb-5 bg-[var(--border)]" />
              
              <div className="flex items-start gap-12">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 text-[var(--text-tertiary)]">
                    ⏱ ESTIMATED TIME
                  </p>
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">
                    1 min
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 text-[var(--text-tertiary)]">
                    🎯 FOCUS
                  </p>
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">
                    Clarity, Pacing, Structure
                  </p>
                </div>
              </div>
            </div>

            {/* Timer + Info Row */}
            <div className="w-full max-w-[680px] flex items-start gap-12 mb-10 pl-6">
              {/* Circular Timer Visual */}
              <div className="relative w-[160px] h-[160px] flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="72" stroke="var(--border)" strokeWidth="6" fill="none" strokeDasharray="4 4" />
                  <circle cx="80" cy="80" r="64" stroke="var(--bg-hover)" strokeWidth="12" fill="none" />
                  <circle
                    cx="80" cy="80" r="64"
                    stroke="#3B82F6" strokeWidth="6" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 64}
                    strokeDashoffset={2 * Math.PI * 64 - (10 / 30) * 2 * Math.PI * 64}
                    style={{ filter: 'drop-shadow(0 4px 8px rgba(59,130,246,0.3))' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center pt-2">
                  <span className="text-[48px] font-[800] leading-none text-[var(--text-primary)] tracking-tight">
                    30
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-[var(--text-tertiary)]">sec prep</span>
                </div>
              </div>

              {/* Right Side Panels */}
              <div className="flex-1 pt-2 pr-4">
                {/* Brainstorm Toggle (using details/summary) */}
                <details className="group mb-8">
                  <summary className="text-[14px] font-bold flex items-center justify-between cursor-pointer list-none text-[var(--text-primary)]">
                    <span className="flex items-center gap-2">
                      <span className="text-blue-500">🧠</span> Need help brainstorming?
                    </span>
                    <span className="text-[var(--text-tertiary)] transition-transform group-open:rotate-180">
                      <ChevronRight size={18} className="rotate-90" />
                    </span>
                  </summary>
                  <div className="pt-4 pl-6 space-y-2">
                    {['Structured thinking', 'Interview confidence', 'Decision-making'].map(item => (
                      <p key={item} className="text-[13px] font-medium flex items-center gap-2 text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        {item}
                      </p>
                    ))}
                  </div>
                </details>

                {/* After Speaking Info */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-4 text-[var(--text-tertiary)]">
                    AFTER SPEAKING YOU'LL RECEIVE:
                  </p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    {[
                      ['📈', 'Confidence Score'],
                      ['📊', 'Structure Analysis'],
                      ['🎤', 'Speaking Feedback'],
                      ['🤖', 'AI Recommendations'],
                    ].map(([emoji, label]) => (
                      <p key={label} className="text-[12px] font-medium flex items-center gap-2.5 text-[var(--text-secondary)]">
                        <span className="text-[14px]">{emoji}</span> {label}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mic error */}
            {recorder.error && (
              <div className="w-full max-w-[680px] mb-4 px-4 py-3 rounded-xl text-[13px] font-medium"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--red)' }}
              >
                ⚠️ Microphone error: {recorder.error}
              </div>
            )}

            {/* Dominant CTA */}
            <div className="w-full max-w-[680px]">
              <button
                disabled={!selectedTopic}
                onClick={() => {
                  if (selectedTopic) {
                    flow.startPrep(selectedTopic)
                  }
                }}
                className="w-full py-5 text-[17px] font-bold rounded-full transition-all duration-300 active:scale-[0.98] relative overflow-hidden"
                style={selectedTopic ? {
                  background: 'var(--accent)',
                  color: '#09090F',
                  boxShadow: '0 0 40px var(--accent-glow), 0 4px 24px rgba(0,0,0,0.3)',
                } : {
                  background: 'var(--bg-card)', color: 'var(--text-tertiary)',
                  cursor: 'not-allowed', border: '1px solid var(--border)',
                }}
                onMouseEnter={e => {
                  if (selectedTopic) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.4)'
                  }
                }}
                onMouseLeave={e => {
                  if (selectedTopic) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px var(--accent-glow), 0 4px 24px rgba(0,0,0,0.3)'
                  }
                }}
              >
                🚀 Start AI-Powered Session
              </button>
            </div>
          </div>
        )}


        {/* ── PREP: Countdown ── */}
        {isPrep && (
          <div className="flex-1 flex flex-col items-center animate-fadeSlideUp w-full pt-4 pb-8 relative">
            {/* Subtle Poppy Topic Card */}
            <div className="w-full max-w-[680px] bg-[var(--bg-card)] rounded-[24px] p-8 mb-10 relative shadow-xl border border-[var(--border)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-blue-500">
                  <span>✨</span> AI SELECTED CHALLENGE
                </span>
                {flow.topic?.difficulty && (
                  <span className="text-[12px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 capitalize bg-[var(--bg-hover)] text-[var(--text-secondary)] shadow-sm border border-[var(--border)]">
                    🔥 Difficulty: {flow.topic.difficulty}
                  </span>
                )}
              </div>
              
              <h2 className="text-[24px] md:text-[26px] font-bold leading-snug mb-8 text-[var(--text-primary)] px-1">
                {flow.topic?.text}
              </h2>
              
              <div className="h-px w-full mb-5 bg-[var(--border)]" />
              
              <div className="flex items-start gap-12">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 text-[var(--text-tertiary)]">
                    ⏱ ESTIMATED TIME
                  </p>
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">
                    1 min
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 text-[var(--text-tertiary)]">
                    🎯 FOCUS
                  </p>
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">
                    Clarity, Pacing, Structure
                  </p>
                </div>
              </div>
            </div>

            {/* Timer + Info Row */}
            <div className="w-full max-w-[680px] flex items-start gap-12 mb-10 pl-6">
              {/* Circular Timer Visual */}
              <div className="relative w-[160px] h-[160px] flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="72" stroke="var(--border)" strokeWidth="6" fill="none" strokeDasharray="4 4" />
                  <circle cx="80" cy="80" r="64" stroke="var(--bg-hover)" strokeWidth="12" fill="none" />
                  <circle
                    cx="80" cy="80" r="64"
                    stroke="#3B82F6" strokeWidth="6" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 64}
                    strokeDashoffset={2 * Math.PI * 64 - (flow.prepSecsLeft / 30) * 2 * Math.PI * 64}
                    className="transition-all duration-1000 ease-linear"
                    style={{ filter: 'drop-shadow(0 4px 8px rgba(59,130,246,0.3))' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center pt-2">
                  <span className="text-[48px] font-[800] leading-none text-[var(--text-primary)] tracking-tight">
                    {flow.prepSecsLeft}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-[var(--text-tertiary)]">sec left</span>
                </div>
              </div>

              {/* Right Side Panels */}
              <div className="flex-1 pt-2 pr-4">
                {/* Brainstorm Toggle */}
                <details className="group mb-8">
                  <summary className="text-[14px] font-bold flex items-center justify-between cursor-pointer list-none text-[var(--text-primary)]">
                    <span className="flex items-center gap-2">
                      <span className="text-blue-500">🧠</span> Need help brainstorming?
                    </span>
                    <span className="text-[var(--text-tertiary)] transition-transform group-open:rotate-180">
                      <ChevronRight size={18} className="rotate-90" />
                    </span>
                  </summary>
                  <div className="pt-4 pl-6 space-y-2">
                    {['Structured thinking', 'Interview confidence', 'Decision-making'].map(item => (
                      <p key={item} className="text-[13px] font-medium flex items-center gap-2 text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        {item}
                      </p>
                    ))}
                  </div>
                </details>

                {/* After Speaking Info */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-4 text-[var(--text-tertiary)]">
                    AFTER SPEAKING YOU'LL RECEIVE:
                  </p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    {[
                      ['📈', 'Confidence Score'],
                      ['📊', 'Structure Analysis'],
                      ['🎤', 'Speaking Feedback'],
                      ['🤖', 'AI Recommendations'],
                    ].map(([emoji, label]) => (
                      <p key={label} className="text-[12px] font-medium flex items-center gap-2.5 text-[var(--text-secondary)]">
                        <span className="text-[14px]">{emoji}</span> {label}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Skip Button */}
            <div className="w-full max-w-[680px]">
              <button
                onClick={() => flow.skipPrep()}
                className="w-[320px] mx-auto block py-4 rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.98] text-white shadow-[0_8px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.4)]"
                style={{ background: '#60A5FA' }}
              >
                Skip Countdown & Start
              </button>
            </div>
          </div>
        )}

        {/* ── RECORDING: Premium AI Active Coach ── */}
        {isRecording && (() => {
          const maxDur = 60
          const elapsed = Math.max(0, maxDur - flow.recSecsLeft)
          const wordsSpoken = Math.round(elapsed * 2.3)
          const completionPct = Math.min(100, Math.round((elapsed / maxDur) * 100))

          return (
            <div className="flex-1 flex flex-col items-center animate-fadeSlideUp w-full max-w-[680px] py-2 relative z-10 mx-auto">
              
              {/* Top Status & Live Badge */}
              <div className="w-full flex items-center justify-between mb-4 px-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm ${isPaused ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' : 'bg-red-500/10 border border-red-500/30 text-red-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-red-500 animate-ping'}`} />
                  <span>{isPaused ? '⏸ Session Paused' : '🔴 Recording Live'}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] font-bold text-[var(--text-secondary)]">
                  <span>Words: <strong className="text-[var(--text-primary)]">{wordsSpoken}</strong></span>
                  <span>•</span>
                  <span>Done: <strong className="text-emerald-500">{completionPct}%</strong></span>
                </div>
              </div>

              {/* Floating Topic Challenge Card */}
              <div 
                className="w-full rounded-[22px] p-6 mb-5 relative shadow-xl border border-[var(--border)] backdrop-blur-xl text-left bg-[var(--bg-card)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-blue-500">
                    🎯 CHALLENGE
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-amber-500 border border-[var(--border)]">
                      🔥 {flow.topic?.difficulty ? flow.topic.difficulty.toUpperCase() : 'MEDIUM'}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-blue-500 border border-[var(--border)]">
                      ⏱ 60s target
                    </span>
                  </div>
                </div>
                <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-snug">
                  {flow.topic?.text}
                </h2>
              </div>

              {/* Dynamic Waveform & AI Listening Indicator Area */}
              <div className="w-full rounded-[22px] p-5 mb-4 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl text-center relative overflow-hidden">
                <div className="flex items-center justify-between mb-2 text-[12px] font-bold">
                  <span className="text-emerald-500 flex items-center gap-1.5">
                    <Activity size={16} className={isPaused ? "" : "animate-pulse"} /> {isPaused ? 'AI Voice Analysis Paused' : 'AI Voice Analysis Active'}
                  </span>
                  <span className="text-[var(--text-tertiary)] font-mono">Volume: {isMuted ? 'Muted' : 'Normal'}</span>
                </div>

                {/* Audio Waveform */}
                <div className="w-full">
                  <AudioWaveform analyserNode={recorder.analyserNode} isRecording={recorder.isRecording && !isPaused} />
                </div>
              </div>

              {/* Rotating AI Guidance Message Card (Clean standalone box) */}
              <div className="w-full mb-5 py-3 px-4 rounded-[16px] bg-emerald-500/10 border border-emerald-500/20 text-[13px] font-semibold text-emerald-500 animate-fadeSlideUp flex items-center justify-center gap-2 shadow-sm">
                <span>{tips[tipIndex]}</span>
              </div>

              {/* Real-Time AI Feedback & Quality Chips Panel */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 text-left">
                
                {/* Dynamic Insights */}
                <div className="p-4 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border)] shadow-md">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-yellow-500" /> Real-Time AI Coaching
                  </h4>
                  <div className="space-y-2 text-[12px] font-medium">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle size={14} className="text-emerald-500" /> Strong confidence in delivery
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle size={14} className="text-emerald-500" /> Good pacing & articulate voice
                    </div>
                    <div className="flex items-center gap-2 text-amber-500">
                      <AlertTriangle size={14} className="text-amber-500" /> Keep pauses brief between thoughts
                    </div>
                  </div>
                </div>

                {/* Live Speech Quality Chips */}
                <div className="p-4 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border)] shadow-md flex flex-col justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Speech Quality Chips
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold flex items-center gap-1">
                      ✓ Confidence: High
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-bold flex items-center gap-1">
                      ✓ Clarity: 94%
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-bold flex items-center gap-1">
                      ⚡ Pacing: Optimal
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-bold flex items-center gap-1">
                      🔥 Energy: Strong
                    </span>
                  </div>
                </div>

              </div>

              {/* Progress Bar & Anticipation Text */}
              <div className="w-full mb-6">
                <div className="flex justify-between items-center text-[11px] font-bold text-[var(--text-tertiary)] mb-1.5">
                  <span>Session Progress ({elapsed}s / {maxDur}s)</span>
                  <span>{isPaused ? '⏸ Paused' : (completionPct >= 80 ? '⚡ AI Analysis Preparing...' : 'Speaking Active')}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>

              {/* Redesigned Control Bar */}
              <div 
                className="w-full rounded-[24px] p-4 bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl flex items-center justify-between gap-4"
              >
                {/* Secondary controls left */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (isPaused) {
                        recorder.resumeRecording()
                        flow.resumeTimer()
                        setIsPaused(false)
                      } else {
                        recorder.pauseRecording()
                        flow.pauseTimer()
                        setIsPaused(true)
                      }
                    }}
                    className="p-3 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border)] font-bold text-[13px] flex items-center gap-1.5 transition-all"
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      recorder.toggleMute()
                      setIsMuted(!isMuted)
                    }}
                    className="p-3 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-all"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff size={16} className="text-red-500" /> : <Volume2 size={16} />}
                  </button>
                </div>

                {/* Stop & Analyse Session CTA */}
                <button
                  onClick={() => recorder.stopRecording()}
                  className="px-6 py-3.5 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 shadow-lg transition-all active:scale-[0.97] hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', boxShadow: '0 4px 20px rgba(239,68,68,0.35)' }}
                >
                  <span className="w-3 h-3 rounded-sm bg-white" />
                  <span>End & Analyze Session</span>
                </button>

              </div>

            </div>
          )
        })()}

        {/* ── UPLOADING / ANALYZING ── */}
        {isUploading && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center gap-6">
            <div className="relative w-24 h-24">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '4px solid var(--border-md)',
                }}
              />
              <div
                className="absolute inset-0 rounded-full border-t-transparent animate-spin"
                style={{
                  border: '4px solid var(--accent)',
                  borderTopColor: 'transparent',
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)',
                  opacity: 0.4,
                  animation: 'pulse-orb 1.5s ease-in-out infinite',
                }}
              />
            </div>
            <div>
              <h2
                className="text-[26px] font-bold mb-3 tracking-[-0.02em]"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                }}
              >
                Analyzing your speech
              </h2>
              <p
                className="text-[15px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                This usually takes about 10–15 seconds…
              </p>
              <p
                className="text-[13px] mt-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Your AI coach is reviewing every word
              </p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center">
            <div
              className="w-20 h-20 rounded-[22px] flex items-center justify-center text-4xl mb-6"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--red)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              ⚠️
            </div>
            <h2
              className="text-[28px] font-bold mb-4 tracking-[-0.02em]"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
              }}
            >
              Something went wrong
            </h2>
            <p
              className="mb-8 max-w-sm text-[15px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {flow.error || 'Failed to upload or analyze the audio.'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="px-8 py-3.5 rounded-[16px] font-bold text-[14px] transition-all duration-200"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'}
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleBack}
                className="px-8 py-3.5 rounded-[16px] font-bold text-[14px] transition-all duration-200"
                style={{
                  background: 'var(--accent)',
                  color: '#09090F',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Global keyframe for recording border pulse */}
      <style>{`
        @keyframes recording-pulse-border {
          0%, 100% { box-shadow: 0 0 0 1px rgba(163,230,53,0.12), 0 8px 32px rgba(0,0,0,0.5); }
          50%       { box-shadow: 0 0 0 2px rgba(163,230,53,0.28), 0 8px 40px rgba(0,0,0,0.6); }
        }
        @keyframes pulse-orb {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.06); }
        }
      `}</style>
    </main>
  )
}