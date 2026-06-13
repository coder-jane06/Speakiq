import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { Zap, Target, Mic, Flame } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Redirect new users to onboarding before their first session
  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/dashboard/profile-status`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.onboarding_complete) {
            navigate(ROUTES.ONBOARDING, { replace: true });
            return;
          }
        }
      } catch {
        // silently ignore — don't block home page
      } finally {
        setCheckingOnboarding(false);
      }
    };
    check();
  }, [user, navigate]);

  if (checkingOnboarding && user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-md)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-primary relative overflow-x-hidden">

      {/* ── HERO SECTION ──────────────────────────────────────────── */}
      <section className="min-h-[92vh] flex items-center">
        <div className="max-w-[1200px] mx-auto w-full px-6 lg:px-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-6 py-16 lg:py-0">

          {/* ── LEFT COLUMN ── */}
          <div className="w-full lg:w-[52%] flex flex-col gap-7 animate-fadeSlideUp">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 self-start">
              <span
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-bold tracking-widest uppercase"
                style={{
                  background: 'rgba(200,249,125,0.08)',
                  border: '1px solid rgba(200,249,125,0.18)',
                  color: 'var(--accent)',
                  letterSpacing: '0.1em',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-orb"
                />
                AI Speech Coach
              </span>
            </div>

            {/* H1 */}
            <h1
              className="text-primary tracking-tight leading-[1.05]"
              style={{
                fontFamily: "'Bricolage Grotesque', -apple-system, sans-serif",
                fontSize: 'clamp(44px, 6vw, 66px)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
              }}
            >
              Speak better,<br />
              <span style={{ color: 'var(--accent)' }}>every single day.</span>
            </h1>

            {/* Subtext */}
            <p className="text-secondary text-[17px] font-medium leading-relaxed max-w-[460px]">
              Practice for 3 minutes a day. Our AI analyzes your delivery, vocabulary, and structure — then adapts to make you sharper.
            </p>

            {/* CTA row */}
            <div className="flex items-center gap-4 mt-1">
              <button
                onClick={() => navigate(user ? ROUTES.SESSION : ROUTES.LOGIN)}
                className="flex items-center gap-2.5 font-bold text-[15px] px-7 py-3.5 rounded-full transition-all active:scale-[0.97]"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg-base)',
                  boxShadow: '0 0 28px rgba(200,249,125,0.22)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(200,249,125,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 28px rgba(200,249,125,0.22)')}
              >
                <Mic size={17} strokeWidth={2.5} />
                Start Session
              </button>
              <span className="text-[12px] text-tertiary font-bold tracking-[0.12em] uppercase">
                Takes &lt; 3 min
              </span>
            </div>

            {/* Social proof pills */}
            <div className="flex items-center gap-2.5 flex-wrap pt-2">
              {[
                { emoji: '🎙️', label: '10k+ sessions' },
                { emoji: '⭐', label: '4.9 rating' },
                { emoji: '🔥', label: 'Daily streaks' },
              ].map((pill) => (
                <span
                  key={pill.label}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{pill.emoji}</span>
                  <span>{pill.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN — waveform visual ── */}
          <div
            className="hidden lg:flex w-[48%] flex-col items-center gap-5"
            style={{ animationDelay: '0.08s' }}
          >
            {/* Glow halo behind card */}
            <div className="relative flex items-center justify-center w-full">
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(200,249,125,0.09) 0%, transparent 70%)',
                  filter: 'blur(24px)',
                  transform: 'scale(1.15)',
                }}
              />

              {/* Waveform card */}
              <div
                className="relative w-full rounded-3xl overflow-hidden animate-fadeSlideUp"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  padding: '48px 40px',
                  animationDelay: '0.1s',
                }}
              >
                {/* Subtle inner glow top-left */}
                <div
                  className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(200,249,125,0.06) 0%, transparent 70%)',
                    filter: 'blur(32px)',
                  }}
                />

                {/* Label */}
                <p
                  className="text-[11px] font-bold tracking-[0.14em] uppercase mb-8"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Live Analysis
                </p>

                {/* 12 waveform bars */}
                <div className="flex items-end gap-2 h-[80px] mb-10">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="wave-bar flex-1 rounded-full"
                      style={{ background: 'rgba(200,249,125,0.8)' }}
                    />
                  ))}
                </div>

                {/* Score ring row */}
                <div className="flex items-center gap-4">
                  <div
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl"
                    style={{ background: 'rgba(200,249,125,0.08)', border: '1px solid rgba(200,249,125,0.12)' }}
                  >
                    <span className="text-[20px] font-bold" style={{ color: 'var(--accent)' }}>92</span>
                    <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-tertiary)' }}>Score</span>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {[
                      { label: 'Delivery', pct: 88, color: '#60A5FA' },
                      { label: 'Clarity', pct: 94, color: '#C8F97D' },
                      { label: 'Pace', pct: 76, color: '#FBBF24' },
                    ].map((dim) => (
                      <div key={dim.label} className="flex items-center gap-2.5">
                        <span className="text-[11px] font-medium w-[50px]" style={{ color: 'var(--text-tertiary)' }}>{dim.label}</span>
                        <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--border)' }}>
                          <div
                            className="h-1 rounded-full transition-all"
                            style={{ width: `${dim.pct}%`, background: dim.color }}
                          />
                        </div>
                        <span className="text-[11px] font-bold w-[28px] text-right" style={{ color: 'var(--text-secondary)' }}>{dim.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating mini-stat pills */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {[
                { icon: '🎯', label: '98 avg score' },
                { icon: '🔥', label: '12 day streak' },
                { icon: '⚡', label: 'Instant AI' },
              ].map((stat, i) => (
                <span
                  key={stat.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold animate-fadeSlideUp"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    animationDelay: `${0.15 + i * 0.05}s`,
                  }}
                >
                  <span>{stat.icon}</span>
                  <span>{stat.label}</span>
                </span>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── FEATURE CARDS ROW ─────────────────────────────────────── */}
      <section className="pb-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">

          {/* Divider */}
          <div className="w-full h-px mb-14" style={{ background: 'var(--border)' }} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Card 1 — AI Analysis */}
            <div
              className="card p-8 hover:border-[var(--border-md)] transition-all animate-fadeSlideUp group"
              style={{ animationDelay: '0.05s' }}
            >
              <div className="flex items-start justify-between mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(96,165,250,0.10)' }}
                >
                  <Zap size={22} strokeWidth={2.5} style={{ color: '#60A5FA' }} />
                </div>
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(96,165,250,0.08)',
                    border: '1px solid rgba(96,165,250,0.18)',
                    color: '#60A5FA',
                  }}
                >
                  Instant
                </span>
              </div>
              <p
                className="text-[36px] font-extrabold mb-1 tracking-tight"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                &lt;2s
              </p>
              <h3 className="text-[16px] font-bold text-primary mb-2">AI Analysis</h3>
              <p className="text-[13.5px] text-secondary font-medium leading-relaxed">
                Get instant feedback on your delivery, structure, and vocabulary from our advanced AI model.
              </p>
            </div>

            {/* Card 2 — Daily Drills */}
            <div
              className="card p-8 hover:border-[var(--border-md)] transition-all animate-fadeSlideUp group"
              style={{ animationDelay: '0.12s' }}
            >
              <div className="flex items-start justify-between mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)' }}
                >
                  <Target size={22} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                </div>
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(200,249,125,0.08)',
                    border: '1px solid rgba(200,249,125,0.18)',
                    color: 'var(--accent)',
                  }}
                >
                  Adaptive
                </span>
              </div>
              <p
                className="text-[36px] font-extrabold mb-1 tracking-tight"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                3 min
              </p>
              <h3 className="text-[16px] font-bold text-primary mb-2">Daily Drills</h3>
              <p className="text-[13.5px] text-secondary font-medium leading-relaxed">
                Personalized exercises designed to improve your weakest areas and reinforce your strengths.
              </p>
            </div>

            {/* Card 3 — Streak System */}
            <div
              className="card p-8 hover:border-[var(--border-md)] transition-all animate-fadeSlideUp group"
              style={{ animationDelay: '0.19s' }}
            >
              <div className="flex items-start justify-between mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(251,191,36,0.10)' }}
                >
                  <Flame size={22} strokeWidth={2.5} style={{ color: '#FBBF24' }} />
                </div>
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.18)',
                    color: '#FBBF24',
                  }}
                >
                  30-Day
                </span>
              </div>
              <p
                className="text-[36px] font-extrabold mb-1 tracking-tight"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                +40%
              </p>
              <h3 className="text-[16px] font-bold text-primary mb-2">Streak System</h3>
              <p className="text-[13.5px] text-secondary font-medium leading-relaxed">
                Build consistency with daily streaks, habit tracking, and visualized progress metrics.
              </p>
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}