import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { Mic, Play, Sparkles, ArrowRight, Star, Users, CheckCircle2, Activity, Brain, Target, ShieldCheck, Zap } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] relative overflow-x-hidden selection:bg-[var(--accent)] selection:text-[var(--bg-base)]">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden z-0">
        <div 
          className="absolute -top-[100px] left-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(200,249,125,0.07) 0%, rgba(9,9,15,0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute top-[150px] right-10 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(96,165,250,0.05) 0%, rgba(9,9,15,0) 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* ── HERO SECTION ──────────────────────────────────────────── */}
      <section className="relative z-10 min-h-[90vh] flex items-center pt-0 pb-6 lg:pt-4 lg:pb-10">
        <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="w-full lg:w-[50%] flex flex-col gap-8 animate-fadeSlideUp">

            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2.5 self-start">
              <span
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[12px] font-bold tracking-widest uppercase backdrop-blur-md transition-all duration-300 hover:border-[var(--accent-glow)]"
                style={{
                  background: 'rgba(200,249,125,0.06)',
                  border: '1px solid rgba(200,249,125,0.2)',
                  color: 'var(--accent)',
                }}
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>Next-Gen AI Speech Coaching</span>
              </span>
            </div>

            {/* Headline */}
            <h1
              className="tracking-tight leading-[1.04] text-[var(--text-primary)]"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 'clamp(46px, 5.5vw, 68px)',
                fontWeight: 800,
                letterSpacing: '-0.035em',
              }}
            >
              Master your speech.<br />
              <span 
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, var(--gradient-hero-from) 0%, var(--gradient-hero-via) 50%, var(--gradient-hero-to) 100%)',
                }}
              >
                Speak with total power.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-[var(--text-secondary)] text-[18px] lg:text-[19px] font-normal leading-relaxed max-w-[520px]">
              Fluently acts as your private real-time communication copilot. Practice for just 3 minutes a day to eliminate filler words, refine your pace, and captivate any audience with effortless confidence.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* Primary CTA */}
              <button
                onClick={() => navigate(user ? ROUTES.SESSION : ROUTES.LOGIN)}
                className="group relative inline-flex items-center justify-center gap-3 font-bold text-[16px] px-8 py-4 rounded-[20px] transition-all duration-300 active:scale-[0.98] cursor-pointer overflow-hidden"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-text)',
                  boxShadow: '0 0 32px rgba(200,249,125,0.28)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 45px rgba(200,249,125,0.45), 0 10px 20px rgba(0,0,0,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 32px rgba(200,249,125,0.28)')}
              >
                <Mic size={19} strokeWidth={2.5} className="transition-transform duration-300 group-hover:scale-110" />
                <span>Start Session</span>
                <ArrowRight size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>

              {/* Secondary CTA */}
              <button
                onClick={scrollToHowItWorks}
                className="inline-flex items-center justify-center gap-2.5 font-semibold text-[15px] px-7 py-4 rounded-[20px] transition-all duration-300 backdrop-blur-md cursor-pointer border hover:bg-[var(--bg-hover)]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: 'var(--border-md)',
                  color: 'var(--text-primary)',
                }}
              >
                <Play size={15} fill="currentColor" className="text-[var(--accent)]" />
                <span>See How It Works</span>
              </button>
            </div>

            {/* Below Hero Social Proof Cards */}
            <div className="mt-6 pt-8 border-t border-[var(--border)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Metric 1 */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-[18px] bg-[var(--bg-card)]/60 border border-[var(--border)] backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">10,000+</div>
                    <div className="text-[12px] text-[var(--text-secondary)] font-medium">Active Learners</div>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-[18px] bg-[var(--bg-card)]/60 border border-[var(--border)] backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Star size={20} fill="currentColor" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">4.9★ Rating</div>
                    <div className="text-[12px] text-[var(--text-secondary)] font-medium">User Satisfaction</div>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-[18px] bg-[var(--bg-card)]/60 border border-[var(--border)] backdrop-blur-sm sm:col-span-1">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 flex-shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">94% Success</div>
                    <div className="text-[12px] text-[var(--text-secondary)] font-medium">Reported Confidence</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN — ENHANCED LIVE ANALYTICS CARD ── */}
          <div className="w-full lg:w-[48%] relative flex flex-col items-center">
            
            {/* Ambient Soft Green Glow Behind Card */}
            <div 
              className="absolute -inset-4 rounded-[40px] pointer-events-none transition-all duration-700"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(200,249,125,0.16) 0%, rgba(200,249,125,0.03) 50%, transparent 75%)',
                filter: 'blur(40px)',
                transform: 'scale(1.08)',
              }}
            />

            {/* Main Interactive Card Shell */}
            <div 
              className="relative w-full rounded-[32px] transition-all duration-500 hover:-translate-y-1.5 group bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl p-8 sm:p-9"
            >
              {/* Subtle Top Inner Light Refraction */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none rounded-t-[32px] overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, var(--border-accent) 50%, transparent 100%)',
                }}
              />

              {/* Card Header: AI Listening & Live Indicator */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-3 h-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
                  </div>
                  <span className="text-[13px] font-extrabold tracking-[0.12em] uppercase text-[var(--accent)] flex items-center gap-1.5">
                    <Brain size={15} />
                    <span>AI Listening & Analyzing</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-md)] text-[11px] font-bold text-[var(--text-primary)] shadow-2xs">
                  <Activity size={12} className="text-blue-400 animate-pulse" />
                  <span>Real-time Audio Engine</span>
                </div>
              </div>

              {/* Animated Waveform Bars Container */}
              <div className="mb-8 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xs backdrop-blur-sm">
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 px-1">
                  <span>Voice Pitch & Modulation</span>
                  <span className="text-[var(--accent)] font-extrabold">Active Stream</span>
                </div>
                <div className="flex items-end justify-between gap-1.5 h-[76px] px-2">
                  {[
                    { h1: '16px', h2: '48px', d: '0s' },
                    { h1: '32px', h2: '64px', d: '0.1s' },
                    { h1: '50px', h2: '28px', d: '0.25s' },
                    { h1: '24px', h2: '56px', d: '0.15s' },
                    { h1: '68px', h2: '36px', d: '0.05s' },
                    { h1: '40px', h2: '72px', d: '0.3s' },
                    { h1: '20px', h2: '44px', d: '0.2s' },
                    { h1: '60px', h2: '24px', d: '0.35s' },
                    { h1: '35px', h2: '68px', d: '0.12s' },
                    { h1: '52px', h2: '30px', d: '0.28s' },
                    { h1: '28px', h2: '60px', d: '0.18s' },
                    { h1: '64px', h2: '38px', d: '0.08s' },
                    { h1: '42px', h2: '70px', d: '0.22s' },
                    { h1: '18px', h2: '46px', d: '0.32s' },
                  ].map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-300"
                      style={{
                        background: i % 3 === 0 
                          ? 'linear-gradient(180deg, #60A5FA 0%, var(--accent) 100%)' 
                          : 'linear-gradient(180deg, var(--accent) 0%, var(--border-accent) 100%)',
                        boxShadow: '0 0 12px var(--accent-glow)',
                        animation: `waveBarDynamic 1.4s ease-in-out infinite alternate`,
                        animationDelay: bar.d,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Score Breakdown Row */}
              <div className="flex items-center gap-5">
                {/* Overall Score Circle/Box */}
                <div 
                  className="flex flex-col items-center justify-center w-20 h-20 rounded-[22px] flex-shrink-0 relative overflow-hidden bg-[var(--accent-dim)] border border-[var(--border-accent)] shadow-xs"
                >
                  <span className="text-[26px] font-extrabold tracking-tight text-[var(--accent)] leading-none" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    94
                  </span>
                  <span className="text-[10px] font-extrabold tracking-widest uppercase text-[var(--text-primary)] mt-1">
                    Overall
                  </span>
                </div>

                {/* Animated Dimension Bars */}
                <div className="flex flex-col gap-2.5 flex-1">
                  {[
                    { label: 'Delivery', pct: 92, color: '#60A5FA' },
                    { label: 'Clarity', pct: 96, color: 'var(--accent)' },
                    { label: 'Pace & Rhythm', pct: 88, color: '#FBBF24' },
                  ].map((dim) => (
                    <div key={dim.label} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-bold text-[var(--text-primary)]">{dim.label}</span>
                        <span className="font-extrabold text-[var(--text-primary)]">{dim.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden p-[1px] border border-[var(--border)]">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${dim.pct}%`,
                            background: dim.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtle Floating Cards Orbiting/Positioned Around Main Card */}
              <div 
                className="hidden sm:flex items-center gap-2.5 absolute -top-4 -right-4 px-4 py-2 rounded-2xl text-[12px] font-bold backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-md)] text-[var(--text-primary)] shadow-2xl animate-float z-20"
                style={{
                  animationDuration: '6s',
                }}
              >
                <Zap size={14} className="text-amber-400 fill-amber-400/20" />
                <span>Pace: 142 wpm (Optimal)</span>
              </div>

              <div 
                className="hidden sm:flex items-center gap-2.5 absolute -bottom-5 -left-4 px-4 py-2 rounded-2xl text-[12px] font-bold backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-md)] text-[var(--text-primary)] shadow-2xl animate-float z-20"
                style={{
                  animationDelay: '1.5s',
                  animationDuration: '7s',
                }}
              >
                <CheckCircle2 size={14} className="text-[var(--accent)]" />
                <span>0 Filler Words Detected</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS SECTION ─────────────────────────────────── */}
      <section id="how-it-works" className="py-24 relative z-10 border-t border-[var(--border)] bg-gradient-to-b from-transparent via-[var(--bg-card)]/30 to-transparent">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">

          {/* Section Header */}
          <div className="text-center max-w-[640px] mx-auto mb-16 animate-fadeSlideUp">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-bold tracking-widest uppercase mb-4 bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)]">
              Simplicity Meets Intelligence
            </span>
            <h2 className="text-[36px] sm:text-[44px] font-extrabold text-[var(--text-primary)] tracking-tight leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              How Fluently Transforms Your Speaking
            </h2>
            <p className="text-[17px] text-[var(--text-secondary)] font-normal mt-3">
              A scientifically proven 4-step daily loop designed to build instinctual confidence in record time.
            </p>
          </div>

          {/* Workflow Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">

            {/* Step 1 */}
            <div className="group relative rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] backdrop-blur-md transition-all duration-300 hover:border-[var(--border-accent)] hover:-translate-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] transition-transform duration-300 group-hover:scale-110">
                    <Mic size={28} strokeWidth={2.2} />
                  </div>
                  <span className="text-[32px] font-black text-white/10 group-hover:text-[var(--accent)]/30 transition-colors" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    01
                  </span>
                </div>
                <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">1. Speak</h3>
                <p className="text-[14.5px] text-[var(--text-secondary)] leading-relaxed font-medium">
                  Record a quick 3-minute session on daily topics, interview questions, or your own presentation slides.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--border)] text-[12px] font-semibold text-[var(--accent)] flex items-center gap-1.5">
                <span>Start speaking instantly</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] backdrop-blur-md transition-all duration-300 hover:border-blue-500/30 hover:-translate-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 transition-transform duration-300 group-hover:scale-110">
                    <Brain size={28} strokeWidth={2.2} />
                  </div>
                  <span className="text-[32px] font-black text-white/10 group-hover:text-blue-400/30 transition-colors" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    02
                  </span>
                </div>
                <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">2. AI Analyzes</h3>
                <p className="text-[14.5px] text-[var(--text-secondary)] leading-relaxed font-medium">
                  Our neural speech engine breaks down your vocal cadence, filler frequency, pause placement, and vocabulary richness.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--border)] text-[12px] font-semibold text-blue-400 flex items-center gap-1.5">
                <span>Multi-modal AI engine</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] backdrop-blur-md transition-all duration-300 hover:border-amber-500/30 hover:-translate-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 transition-transform duration-300 group-hover:scale-110">
                    <Activity size={28} strokeWidth={2.2} />
                  </div>
                  <span className="text-[32px] font-black text-white/10 group-hover:text-amber-400/30 transition-colors" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    03
                  </span>
                </div>
                <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">3. Personalized Feedback</h3>
                <p className="text-[14.5px] text-[var(--text-secondary)] leading-relaxed font-medium">
                  Get crystal-clear scores with exact timestamps, highlighting strengths and precise areas to polish.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--border)] text-[12px] font-semibold text-amber-400 flex items-center gap-1.5">
                <span>Actionable, pinpoint insights</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="group relative rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] backdrop-blur-md transition-all duration-300 hover:border-teal-500/30 hover:-translate-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400 transition-transform duration-300 group-hover:scale-110">
                    <Target size={28} strokeWidth={2.2} />
                  </div>
                  <span className="text-[32px] font-black text-white/10 group-hover:text-teal-400/30 transition-colors" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    04
                  </span>
                </div>
                <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">4. Improve Every Day</h3>
                <p className="text-[14.5px] text-[var(--text-secondary)] leading-relaxed font-medium">
                  Unlock daily micro-challenges matched to your skill level, build habit streaks, and track tangible growth over time.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--border)] text-[12px] font-semibold text-teal-400 flex items-center gap-1.5">
                <span>Continuous growth system</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Dynamic Keyframe Injection for Wavebar Animations */}
      <style>{`
        @keyframes waveBarDynamic {
          0% { height: 16px; }
          100% { height: 72px; }
        }
      `}</style>

    </main>
  );
}
