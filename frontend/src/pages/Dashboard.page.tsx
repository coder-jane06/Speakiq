import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mic, Trophy, Flame, Target, Sparkles, Clock,
  ChevronRight, Play, RefreshCw, BarChart2,
  TrendingUp, Zap, CheckCircle
} from 'lucide-react';

interface SessionScore {
  filler: number;
  delivery: number;
  structure: number;
  vocab: number;
  confidence: number;
}

interface DashboardStats {
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  sessions: {
    session_number: number;
    id: string;
    date: string;
    topic: string;
    scores: SessionScore;
  }[];
  improvements: {
    [key: string]: { day1: number; today: number; change: number };
  };
  weekly_goal: {
    completed: number;
    target: number;
    percent: number;
    remaining: number;
  };
  today_focus: {
    title: string;
    description: string;
    estimated_minutes: number;
    tags: string[];
    skill: string;
  };
  mini_insights: {
    confidence: number;
    vocab: number;
    delivery: number;
    structure: number;
    has_enough_data: boolean;
  };
  suggestions: { title: string; desc: string; tag: string }[];
  achievements: {
    id: string;
    icon: string;
    title: string;
    desc: string;
    unlocked: boolean;
    progress: number;
    text_progress: string;
  }[];
  top_fillers: { word: string; count: number }[];
  best_session: { date: string; avg_score: number };
  display_name: string;
  speaking_goal: string;
  difficulty_tier: string;
  profile_badge: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/dashboard/stats`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }}
          />
          <p className="text-[14px] font-semibold text-[var(--text-secondary)]">Loading your speaking hub…</p>
        </div>
      </div>
    );
  }

  // ── Derived values — ALL from backend, zero hardcoding ────────────────────
  const emailName = user?.email
    ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)
    : '';
  const userName = stats?.display_name || user?.user_metadata?.full_name || emailName || 'Speaker';
  const streak = stats?.current_streak ?? 0;
  const latestSession = stats?.sessions && stats.sessions.length > 0
    ? stats.sessions[stats.sessions.length - 1]
    : null;

  // Profile badge: from backend (contains speaking_goal + difficulty from real profile)
  const profileBadge = stats?.profile_badge || 'Speaking Mastery • Beginner Journey';

  // Greeting based on local time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Mini insights: actual score deltas from last two sessions (backend)
  const miniInsights = stats?.mini_insights;
  const hasInsightData = miniInsights?.has_enough_data ?? false;

  // Weekly goal circle progress
  const weeklyGoal = stats?.weekly_goal ?? { completed: 0, target: 7, percent: 0, remaining: 7 };

  // Today's focus: fully from backend (derived from weakest skill + goal)
  const todayFocus = stats?.today_focus;

  return (
    <main className="min-h-screen pb-28 relative overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient background */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.12) 0%, rgba(34,197,94,0.04) 50%, transparent 70%)', filter: 'blur(90px)' }}
      />

      <div className="max-w-[1140px] mx-auto px-6 sm:px-8 pt-8 relative z-10 space-y-10">

        {/* ── SECTION 1 — Welcome Hero ── */}
        <section className="w-full rounded-[32px] p-8 sm:p-10 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full">
            <div className="space-y-4 w-full">
              {/* Profile badge: from backend based on real speaking_goal + difficulty */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-bold shadow-xs">
                <Sparkles size={15} className="text-emerald-400 fill-emerald-400 animate-pulse" />
                <span>{profileBadge}</span>
              </div>

              <h1
                className="text-[36px] sm:text-[46px] font-[800] text-[var(--text-primary)] tracking-[-0.03em] leading-[1.1]"
                style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
              >
                {greeting}, {userName} 👋
              </h1>

              {/* Dynamic subtitle: from today_focus skill */}
              <p className="text-[17px] sm:text-[19px] text-[var(--text-secondary)] font-medium leading-relaxed max-w-3xl">
                {todayFocus
                  ? `Today's focus: ${todayFocus.title}. ${todayFocus.description}`
                  : 'Complete your first session to unlock personalized coaching!'}
              </p>

              {/* Quick status chips — real data */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)] shadow-xs">
                  <Flame size={16} className="text-orange-500 fill-orange-500" />
                  <span>Current streak: <strong className="text-orange-500">{streak} {streak === 1 ? 'Day' : 'Days'}</strong></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)] shadow-xs">
                  <Target size={16} className="text-emerald-500" />
                  <span>
                    Weekly progress:{' '}
                    <strong>{weeklyGoal.completed}/{weeklyGoal.target} sessions</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)] shadow-xs">
                  <Clock size={16} className="text-blue-500" />
                  <span>
                    Est. practice:{' '}
                    <strong>{todayFocus?.estimated_minutes ?? 1} min</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ── SECTION 2 — Today's Focus (from backend: weakest_skill + speaking_goal) ── */}
        <section className="w-full">
          <div className="rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                🎯 TODAY'S CHALLENGE
              </span>
              <h2 className="text-[28px] font-[800] text-[var(--text-primary)] tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {todayFocus?.title || 'Start Your First Session'}
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                {todayFocus?.description || 'Complete a session to get a personalized daily challenge based on your weaknesses.'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[12px] font-bold text-[var(--text-secondary)] bg-[var(--bg-hover)] px-3 py-1 rounded-xl border border-[var(--border)] flex items-center gap-1">
                  <Clock size={13} className="text-[var(--text-tertiary)]" />
                  {todayFocus?.estimated_minutes ?? 1} minute{(todayFocus?.estimated_minutes ?? 1) !== 1 ? 's' : ''}
                </span>
                {(todayFocus?.tags ?? []).map((tag: string, i: number) => (
                  <span key={i} className="text-[12px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/session')}
              className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-extrabold text-[15px] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg cursor-pointer shrink-0 w-full md:w-auto text-center"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              <Play size={18} style={{ fill: 'var(--accent-text)' }} />
              <span>Start Challenge</span>
            </button>
          </div>
        </section>


        {/* ── SECTION 3 — Quick Actions ── */}
        <section className="w-full">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-5 tracking-tight">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Start Session',
                desc: 'Launch AI speaking prompt',
                icon: Mic,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                onClick: () => navigate('/session'),
              },
              {
                title: 'Practice Drill',
                desc: todayFocus?.description?.slice(0, 60) + '…' || 'Target your weakest skill',
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                onClick: () => navigate('/session'),
              },
              {
                title: 'View Progress',
                desc: `${stats?.total_sessions ?? 0} sessions completed`,
                icon: BarChart2,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                onClick: () => navigate('/dashboard'),
              },
              {
                title: 'Review Last Session',
                desc: latestSession ? `Topic: ${latestSession.topic?.slice(0, 35) || 'Last session'}` : 'No sessions yet',
                icon: RefreshCw,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                onClick: () => {
                  if (latestSession) navigate(`/session/${latestSession.id}/results`);
                  else navigate('/session');
                },
              },
            ].map((action, i) => (
              <div
                key={i}
                onClick={action.onClick}
                className="p-6 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border)] shadow-lg hover:bg-[var(--bg-hover)] hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group flex flex-col justify-between h-[170px]"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <action.icon size={22} />
                  </div>
                  <ChevronRight size={18} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[var(--text-primary)] group-hover:text-emerald-400 transition-colors">
                    {action.title}
                  </h4>
                  <p className="text-[12px] text-[var(--text-tertiary)] font-medium mt-0.5">
                    {action.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ── 2 COLUMN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT: Recent Activity */}
          <section className="lg:col-span-2 rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Clock size={20} className="text-emerald-500" /> Recent Activity
              </h3>
              <button onClick={() => navigate('/session')} className="text-[13px] font-bold text-emerald-400 hover:underline flex items-center gap-1">
                New Session <ChevronRight size={14} />
              </button>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border)]">
              {stats?.sessions && stats.sessions.length > 0 ? (
                [...stats.sessions].reverse().slice(0, 5).map((act, idx) => {
                  const score = Math.round(
                    (act.scores.filler + act.scores.delivery + act.scores.structure + act.scores.vocab + act.scores.confidence) / 5
                  );
                  const badgeColor = score >= 85
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : score >= 70
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';

                  return (
                    <div
                      key={idx}
                      onClick={() => navigate(`/session/${act.id}/results`)}
                      className="relative flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xs hover:border-emerald-500/30 hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                    >
                      <div className="absolute -left-[31px] w-5 h-5 rounded-full bg-[var(--bg-card)] border-4 border-emerald-500 shadow-xs" />
                      <div className="min-w-0 flex-1 mr-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{act.date}</span>
                        <h5 className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5 truncate">{act.topic || 'Speaking Practice'}</h5>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {Object.entries(act.scores).slice(0, 3).map(([key, val]) => (
                            <span key={key} className="text-[10px] font-bold text-[var(--text-tertiary)] capitalize">
                              {key}: <span className="text-[var(--text-secondary)]">{val}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-xl border text-[13px] font-extrabold shrink-0 ${badgeColor}`}>
                        {score}/100
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <p className="text-[14px] text-[var(--text-tertiary)] font-medium mb-4">No sessions yet.</p>
                  <button
                    onClick={() => navigate('/session')}
                    className="px-5 py-2.5 rounded-xl font-bold text-[13px] cursor-pointer"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    Start First Session
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Weekly Goal + Mini Insights */}
          <div className="space-y-8">

            {/* Weekly Goal */}
            <section className="rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl text-center flex flex-col items-center">
              <h3 className="text-[18px] font-bold text-[var(--text-primary)] mb-4 tracking-tight">Weekly Goal</h3>

              <div className="relative w-32 h-32 flex items-center justify-center my-2">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[var(--border)]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-1000"
                    strokeDasharray={`${weeklyGoal.percent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-[20px] font-extrabold text-[var(--text-primary)]">{weeklyGoal.percent}%</span>
                  <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">
                    {weeklyGoal.completed} / {weeklyGoal.target}
                  </span>
                </div>
              </div>

              <p className="text-[12px] font-medium text-[var(--text-secondary)] mt-2 px-2">
                {weeklyGoal.remaining > 0
                  ? `${weeklyGoal.remaining} more session${weeklyGoal.remaining !== 1 ? 's' : ''} to complete this week's goal.`
                  : `You've completed your weekly goal! 🎉`}
              </p>
            </section>

            {/* Mini Insights — real score deltas, no mock numbers */}
            <section className="rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
              <h3 className="text-[18px] font-bold text-[var(--text-primary)] mb-4 tracking-tight flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" /> Score Changes
              </h3>

              {!hasInsightData ? (
                <p className="text-[12px] text-[var(--text-tertiary)] font-medium text-center py-4">
                  Complete 2+ sessions to see your score deltas.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'confidence' as const, label: 'Confidence', bg: 'bg-emerald-500/10 border-emerald-500/20', textCol: 'text-emerald-400' },
                    { key: 'vocab' as const, label: 'Vocabulary', bg: 'bg-blue-500/10 border-blue-500/20', textCol: 'text-blue-400' },
                    { key: 'delivery' as const, label: 'Delivery', bg: 'bg-purple-500/10 border-purple-500/20', textCol: 'text-purple-400' },
                    { key: 'structure' as const, label: 'Structure', bg: 'bg-amber-500/10 border-amber-500/20', textCol: 'text-amber-400' },
                  ].map((insight) => {
                    const val = miniInsights?.[insight.key] ?? 0;
                    const isUp = val >= 0;
                    return (
                      <div key={insight.key} className={`p-3 rounded-2xl ${insight.bg} border flex flex-col justify-between`}>
                        <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">{insight.label}</span>
                        <span className={`text-[16px] font-extrabold ${insight.textCol} flex items-center gap-1 mt-1`}>
                          {isUp ? '↑' : '↓'} {Math.abs(val)}
                          <span className="text-[10px] font-medium text-[var(--text-tertiary)] ml-0.5">pts</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </div>


        {/* ── Achievements ── */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Trophy size={20} className="text-amber-500 fill-amber-500" /> Achievements
            </h3>
            {stats?.achievements && (
              <span className="text-[12px] font-bold text-[var(--text-tertiary)]">
                {stats.achievements.filter(a => a.unlocked).length}/{stats.achievements.length} unlocked
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(stats?.achievements || []).map((ach, i) => {
              const styles = [
                { card: 'from-amber-500/10 to-orange-500/5 border-amber-500/30 hover:border-amber-500/60', badge: 'bg-amber-500/15 border-amber-500/30 text-amber-500', bar: '#f59e0b' },
                { card: 'from-blue-500/10 to-indigo-500/5 border-blue-500/30 hover:border-blue-500/60', badge: 'bg-blue-500/15 border-blue-500/30 text-blue-500', bar: '#3b82f6' },
                { card: 'from-red-500/10 to-orange-500/5 border-red-500/30 hover:border-red-500/60', badge: 'bg-red-500/15 border-red-500/30 text-red-500', bar: '#ef4444' },
                { card: 'from-emerald-500/10 to-green-500/5 border-emerald-500/30 hover:border-emerald-500/60', badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500', bar: '#10b981' },
                { card: 'from-purple-500/10 to-fuchsia-500/5 border-purple-500/30 hover:border-purple-500/60', badge: 'bg-purple-500/15 border-purple-500/30 text-purple-500', bar: '#a855f7' },
                { card: 'from-cyan-500/10 to-teal-500/5 border-cyan-500/30 hover:border-cyan-500/60', badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-500', bar: '#06b6d4' },
                { card: 'from-rose-500/10 to-pink-500/5 border-rose-500/30 hover:border-rose-500/60', badge: 'bg-rose-500/15 border-rose-500/30 text-rose-500', bar: '#f43f5e' },
                { card: 'from-indigo-500/10 to-blue-500/5 border-indigo-500/30 hover:border-indigo-500/60', badge: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-500', bar: '#6366f1' },
              ];
              const s = styles[i % styles.length];
              return (
                <div
                  key={ach.id}
                  className={`p-5 rounded-[24px] border shadow-md backdrop-blur-xl flex flex-col gap-3 transition-all duration-300 relative overflow-hidden bg-[var(--bg-card)] bg-gradient-to-br via-[var(--bg-card)] ${
                    ach.unlocked
                      ? `${s.card} hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl cursor-pointer group`
                      : 'border-[var(--border)] opacity-60 hover:opacity-80'
                  }`}
                >
                  {/* Unlocked glow pulse */}
                  {ach.unlocked && (
                    <div className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(ellipse at top left, ${s.bar}18 0%, transparent 70%)` }} />
                  )}

                  <div className="flex items-center gap-3 relative">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] shrink-0 border ${
                      ach.unlocked
                        ? `${s.badge} ${ach.unlocked ? 'group-hover:scale-110 group-hover:rotate-6' : ''} transition-transform duration-300 shadow-lg`
                        : 'bg-[var(--bg-hover)] border-[var(--border)] grayscale'
                    }`}>
                      {ach.unlocked ? ach.icon : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-[14px] font-extrabold tracking-tight truncate transition-colors ${
                        ach.unlocked ? 'text-[var(--text-primary)] group-hover:text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                      }`}>{ach.title}</h4>
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)] mt-0.5 leading-tight line-clamp-2">{ach.desc}</p>
                    </div>
                  </div>

                  {/* Progress bar for locked achievements */}
                  {!ach.unlocked && (
                    <div className="relative">
                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${ach.progress}%`, background: s.bar }}
                        />
                      </div>
                      <p className="text-[10px] font-semibold text-[var(--text-tertiary)] mt-1.5">{ach.text_progress}</p>
                    </div>
                  )}

                  {/* Unlocked badge */}
                  {ach.unlocked && (
                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border self-start ${s.badge}`}>
                      <CheckCircle size={9} /> UNLOCKED
                    </div>
                  )}
                </div>
              );
            })}

            {(!stats?.achievements || stats.achievements.length === 0) && (
              <div className="col-span-full p-8 text-center text-[var(--text-tertiary)] border border-dashed border-[var(--border)] rounded-[24px]">
                Complete sessions to unlock achievements and track your journey!
              </div>
            )}
          </div>
        </section>


        {/* ── Suggested for You — from backend (based on weakest skill + speaking_goal) ── */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">Suggested for You</h3>
            <span className="text-[12px] font-bold text-[var(--text-tertiary)]">Tailored to your weakest skill</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(stats?.suggestions && stats.suggestions.length > 0) ? stats.suggestions.map((sug, i) => (
              <div
                key={i}
                onClick={() => navigate('/session')}
                className="p-6 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border)] shadow-md hover:shadow-xl hover:border-emerald-500/40 hover:bg-[var(--bg-hover)] transition-all cursor-pointer flex flex-col justify-between h-[180px] group"
              >
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-2xs">
                    {sug.tag || 'Recommended'}
                  </span>
                  <h4 className="text-[17px] font-bold text-[var(--text-primary)] mt-3 group-hover:text-emerald-400 transition-colors">
                    {sug.title}
                  </h4>
                  <p className="text-[12px] text-[var(--text-secondary)] font-medium mt-1">
                    {sug.desc}
                  </p>
                </div>
                <div className="flex items-center text-[12px] font-extrabold text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span>Start Module</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            )) : (
              <div className="col-span-full p-8 text-center text-[var(--text-tertiary)] border border-dashed border-[var(--border)] rounded-[24px]">
                Complete more sessions to get tailored practice suggestions!
              </div>
            )}
          </div>
        </section>


        {/* ── Milestones ── */}
        <section className="w-full rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-5 tracking-tight flex items-center gap-2">
            <Target size={20} className="text-emerald-500" /> Upcoming Milestones
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🥈',
                text: streak < 7
                  ? `${7 - streak} more days to reach a 7-day streak`
                  : streak < 30
                    ? `${30 - streak} more days to reach a 30-day streak`
                    : '🔥 30-day streak legend!',
                progress: Math.min(100, (streak / 7) * 100),
              },
              {
                icon: '⭐',
                text: stats?.best_session?.avg_score
                  ? stats.best_session.avg_score >= 100
                    ? 'Perfect score achieved! 🏆'
                    : `${100 - stats.best_session.avg_score} points to reach a perfect 100 score`
                  : 'Complete a session to track your best score',
                progress: stats?.best_session?.avg_score ?? 0,
              },
              {
                icon: '🚀',
                text: (stats?.total_sessions ?? 0) >= 30
                  ? '🎉 30-session milestone reached!'
                  : `${30 - (stats?.total_sessions ?? 0)} sessions until Advanced Level`,
                progress: Math.min(100, ((stats?.total_sessions ?? 0) / 30) * 100),
              },
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[22px]">{m.icon}</span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)] leading-snug">{m.text}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, m.progress)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
