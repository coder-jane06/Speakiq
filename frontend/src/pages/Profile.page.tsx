import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES, API_URL } from '../constants';
import { supabase } from '../services/supabase';
import { LogOut, Flame, Star, Mic, Trophy, Calendar, TrendingUp, LayoutDashboard } from 'lucide-react';

interface ProfileStats {
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  sessions?: any[];
  best_session?: any;
}

// ── Dimension ring config ──────────────────────────────────────────
const DIMENSIONS = [
  { key: 'delivery',   label: 'Delivery',   color: '#60A5FA' },
  { key: 'filler',     label: 'Filler',     color: '#C8F97D' },
  { key: 'structure',  label: 'Structure',  color: '#FBBF24' },
  { key: 'vocab',      label: 'Vocab',      color: '#A78BFA' },
  { key: 'confidence', label: 'Confidence', color: '#2DD4BF' },
] as const;

const RING_RADIUS = 24;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS; // ≈ 150.8

function SkillRing({
  score,
  color,
  label,
}: {
  score: number;
  color: string;
  label: string;
}) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const filled = pct * RING_CIRCUM;
  const gap = RING_CIRCUM - filled;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 60 60" width={60} height={60} style={{ transform: 'rotate(-90deg)' }}>
        {/* track */}
        <circle
          cx="30"
          cy="30"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="5"
        />
        {/* filled arc */}
        <circle
          cx="30"
          cy="30"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
        />
      </svg>
      <div className="text-center">
        <p
          className="text-[13px] font-bold leading-none mb-0.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {score > 0 ? Math.round(score) : '–'}
        </p>
        <p
          className="text-[10px] font-medium leading-tight"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Use the SAME auth pattern as Dashboard — supabase.auth.getSession() for a fresh token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/dashboard/stats`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.HOME);
  };

  const currentStreak  = stats?.current_streak || 0;
  const longestStreak  = stats?.longest_streak  || 0;
  const totalSessions  = stats?.total_sessions  || 0;
  const bestAvg        = stats?.best_session?.avg_score
    ? Math.round(stats.best_session.avg_score)
    : 0;

  // Calculate member since from user metadata
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  // Latest session for dimension rings
  const latestSession = stats?.sessions && stats.sessions.length > 0
    ? stats.sessions[stats.sessions.length - 1]
    : null;

  const getDimScore = (key: string) =>
    latestSession?.scores?.[key] ?? 0;

  // Recent 3 sessions for mini-list
  const recentSessions = stats?.sessions
    ? [...stats.sessions].reverse().slice(0, 3)
    : [];

  const initials = user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <main
      className="min-h-screen animate-fadeSlideUp"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="max-w-[1060px] mx-auto px-6 lg:px-10 py-10 flex flex-col gap-8">

        {/* ── PROFILE HEADER CARD ── */}
        <div
          className="border rounded-[24px] p-8 flex items-center gap-6 relative overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {/* accent glow blob */}
          <div
            className="absolute top-0 right-0 w-[380px] h-[380px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(200,249,125,0.07) 0%, transparent 70%)',
              transform: 'translate(30%, -40%)',
            }}
          />

          {/* Avatar */}
          <div
            className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center text-[28px] font-bold shrink-0 relative z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(200,249,125,0.2), rgba(200,249,125,0.06))',
              border: '1.5px solid rgba(200,249,125,0.2)',
              color: 'var(--accent)',
            }}
          >
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 relative z-10 min-w-0">
            <h1
              className="text-[28px] font-[700] tracking-tight leading-none mb-1"
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                color: 'var(--text-primary)',
              }}
            >
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Your Profile'}
            </h1>
            <p className="text-[14px] font-medium mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>
              {user?.email || 'Unknown'}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Member since {memberSince}
            </p>
          </div>

          {/* Goal badge + Sign Out */}
          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border"
              style={{
                background: 'var(--accent-dim)',
                borderColor: 'var(--border-accent)',
                color: 'var(--accent)',
              }}
            >
              🎯 Active Speaker
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 h-[40px] px-4 rounded-[12px] text-[13px] font-semibold border transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
              style={{
                background: 'rgba(239,68,68,0.08)',
                color: '#F87171',
                borderColor: 'rgba(239,68,68,0.15)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            >
              <LogOut size={14} strokeWidth={2.5} />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── 4 STAT TILES ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={<Flame size={18} strokeWidth={2.5} />}
            title="Current Streak"
            value={loading ? '–' : `${currentStreak}`}
            unit="days"
            accent="orange"
          />
          <StatTile
            icon={<Star size={18} strokeWidth={2.5} />}
            title="Longest Streak"
            value={loading ? '–' : `${longestStreak}`}
            unit="days"
            accent="amber"
          />
          <StatTile
            icon={<Mic size={18} strokeWidth={2.5} />}
            title="Total Sessions"
            value={loading ? '–' : `${totalSessions}`}
            unit="completed"
            accent="green"
          />
          <StatTile
            icon={<Trophy size={18} strokeWidth={2.5} />}
            title="Best Score"
            value={loading ? '–' : totalSessions > 0 ? `${bestAvg}` : '–'}
            unit="avg"
            accent="blue"
          />
        </div>

        {/* ── BOTTOM 2-COLUMN ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT — Skill Rings */}
          <div
            className="lg:w-[380px] shrink-0 rounded-[20px] border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <h2
              className="text-[16px] font-[700] mb-6"
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                color: 'var(--text-primary)',
              }}
            >
              Skill Breakdown
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--border-md)] border-t-[var(--accent)] animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-4">
                  {DIMENSIONS.map(({ key, label, color }) => (
                    <SkillRing
                      key={key}
                      score={getDimScore(key)}
                      color={color}
                      label={label}
                    />
                  ))}
                </div>
                {latestSession ? (
                  <p
                    className="text-[11px] mt-6 pt-4 border-t text-center"
                    style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}
                  >
                    Scores from session #{latestSession.session_number} ·{' '}
                    {new Date(latestSession.date).toLocaleDateString()}
                  </p>
                ) : (
                  <p
                    className="text-[12px] mt-6 text-center italic"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Complete a session to see your skill rings.
                  </p>
                )}
              </>
            )}
          </div>

          {/* RIGHT — Activity Panel */}
          <div className="flex-1 flex flex-col gap-4">

            {/* Consistency card */}
            <div
              className="rounded-[20px] border p-6 flex items-start gap-4 transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                <Calendar size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Consistency
                </p>
                <p
                  className="text-[15px] font-medium leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {totalSessions === 0
                    ? 'Start your first session to begin tracking your streak.'
                    : currentStreak > 0
                      ? `You're on a ${currentStreak}-day streak. Keep the momentum! 🔥`
                      : 'Your streak reset. Start a session today to rebuild it.'}
                </p>
              </div>
            </div>

            {/* Improvement card */}
            <div
              className="rounded-[20px] border p-6 flex items-start gap-4 transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                style={{ background: 'rgba(96,165,250,0.12)', color: 'var(--blue)' }}
              >
                <TrendingUp size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Improvement
                </p>
                <p
                  className="text-[15px] font-medium leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {totalSessions < 2
                    ? 'Complete 2+ sessions to start seeing your improvement trends.'
                    : `Your best average score is ${bestAvg}. Check the dashboard for detailed trends.`}
                </p>
              </div>
            </div>

            {/* Recent Sessions mini-list */}
            {recentSessions.length > 0 && (
              <div
                className="rounded-[20px] border p-6"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-widest mb-4"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Recent Sessions
                </p>
                <div className="flex flex-col gap-2">
                  {recentSessions.map((s: any) => {
                    const avg = s.scores
                      ? Math.round((s.scores.filler + s.scores.delivery + s.scores.structure + s.scores.vocab + s.scores.confidence) / 5)
                      : 0;
                    let scoreBg = 'rgba(239,68,68,0.1)';
                    let scoreColor = 'var(--red)';
                    if (avg >= 80) { scoreBg = 'var(--accent-dim)'; scoreColor = 'var(--accent)'; }
                    else if (avg >= 60) { scoreBg = 'rgba(251,191,36,0.1)'; scoreColor = 'var(--amber)'; }
                    return (
                      <div
                        key={s.id || s.session_number}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-semibold truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {s.topic || 'Custom Topic'}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            {new Date(s.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className="ml-3 shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-[8px]"
                          style={{ background: scoreBg, color: scoreColor }}
                        >
                          {avg}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dashboard CTA */}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-[14px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg-base)',
              }}
            >
              <LayoutDashboard size={16} strokeWidth={2.5} />
              Go to Dashboard
            </button>

          </div>
          {/* end right activity panel */}
        </div>
        {/* end bottom 2-col */}

      </div>
    </main>
  );
}

// ── StatTile Component ─────────────────────────────────────────────
function StatTile({
  icon,
  title,
  value,
  unit,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit: string;
  accent: 'orange' | 'amber' | 'green' | 'blue' | 'muted';
}) {
  const palette = {
    orange: { iconBg: 'rgba(249,115,22,0.12)', iconColor: '#FB923C', valColor: '#FB923C' },
    amber:  { iconBg: 'rgba(251,191,36,0.12)', iconColor: '#FBBF24', valColor: '#FBBF24' },
    green:  { iconBg: 'var(--accent-dim)',      iconColor: 'var(--accent)', valColor: 'var(--accent)' },
    blue:   { iconBg: 'rgba(96,165,250,0.12)', iconColor: '#60A5FA', valColor: '#60A5FA' },
    muted:  { iconBg: 'rgba(255,255,255,0.05)', iconColor: 'var(--text-tertiary)', valColor: 'var(--text-tertiary)' },
  };
  const c = palette[accent];

  return (
    <div
      className="rounded-[18px] border p-5 flex flex-col gap-3 transition-colors duration-200"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-md)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: c.iconBg, color: c.iconColor }}
        >
          {icon}
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-wider leading-tight"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {title}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-auto">
        <span
          className="text-[34px] font-[700] tracking-tight leading-none"
          style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            color: c.valColor,
          }}
        >
          {value}
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}