import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Mic, Trophy, Flame, Target, Sparkles, Clock, 
  ChevronRight, Play, RefreshCw, BarChart2, 
  TrendingUp, Zap
} from 'lucide-react';

interface DashboardStats {
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  speaking_goal?: string;
  difficulty_tier?: string;
  profile_badge?: string;
  weekly_goal?: {
    completed: number;
    target: number;
    percent: number;
    remaining: number;
  };
  mini_insights?: {
    confidence: number;
    vocab: number;
    delivery: number;
    structure: number;
    has_enough_data: boolean;
  };
  today_focus?: {
    title: string;
    description: string;
    skill: string;
    tags: string[];
    estimated_minutes: number;
  };
  suggestions?: {
    title: string;
    desc: string;
    tag: string;
  }[];
  sessions: {
    session_number: number;
    id: string;
    date: string;
    topic: string;
    scores: {
      filler: number;
      delivery: number;
      structure: number;
      vocab: number;
      confidence: number;
    };
  }[];
  improvements: {
    [key: string]: { day1: number; today: number; change: number };
  };
  top_fillers: { word: string; count: number }[];
  best_session: { date: string; avg_score: number };
  display_name?: string;
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
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
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
          <div className="w-10 h-10 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
          <p className="text-[14px] font-semibold text-gray-500">Loading your speaking hub…</p>
        </div>
      </div>
    );
  }

  const emailName = user?.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : '';
  const userName = stats?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.display_name || emailName || 'Speaker';
  const streak = stats?.current_streak ?? 0;
  const latestSession = stats?.sessions && stats.sessions.length > 0 ? stats.sessions[stats.sessions.length - 1] : null;
  const weeklyGoal = stats?.weekly_goal || { completed: 0, target: 7, percent: 0, remaining: 7 };
  const todayFocus = stats?.today_focus || {
    title: 'Speaking Practice',
    description: 'Complete one short session to unlock personalized recommendations.',
    skill: 'structure',
    tags: ['Clarity', 'Pacing', 'Structure'],
    estimated_minutes: 1,
  };
  const dashboardSuggestions = stats?.suggestions?.length ? stats.suggestions : [
    { title: 'Start Session', desc: 'Complete a session to unlock tailored suggestions.', tag: 'Start' },
  ];

  // --- Dynamic Dashboard Logic ---
  let confidenceDiff = 0, vocabDiff = 0, deliveryDiff = 0, structureDiff = 0;
  if (stats?.mini_insights?.has_enough_data) {
      confidenceDiff = stats.mini_insights.confidence;
      vocabDiff = stats.mini_insights.vocab;
      deliveryDiff = stats.mini_insights.delivery;
      structureDiff = stats.mini_insights.structure;
  } else if (stats?.sessions && stats.sessions.length >= 2) {
      const sorted = [...stats.sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const current = sorted[sorted.length - 1].scores;
      const prev = sorted[sorted.length - 2].scores;
      confidenceDiff = current.confidence - prev.confidence;
      vocabDiff = current.vocab - prev.vocab;
      deliveryDiff = current.delivery - prev.delivery;
      structureDiff = current.structure - prev.structure;
  }

  const formatDiff = (diff: number) => {
      if (diff > 0) return `↑ ${diff}%`;
      if (diff < 0) return `↓ ${Math.abs(diff)}%`;
      return `- 0%`;
  };
  const getDiffColor = (diff: number) => {
      if (diff > 0) return 'text-emerald-400';
      if (diff < 0) return 'text-amber-400';
      return 'text-gray-400';
  };

  const dynamicAchievements = [];
  if (streak >= 5) {
      dynamicAchievements.push({ title: '🏆 5 Day Streak', desc: 'Consistent daily practice', color: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400' });
  } else if (streak >= 3) {
      dynamicAchievements.push({ title: '🔥 3 Day Streak', desc: 'Building momentum!', color: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400' });
  }
  
  if (stats?.sessions?.some(s => s.scores.confidence >= 85)) {
      dynamicAchievements.push({ title: '🎯 Confidence Master', desc: 'Reached 85+ score', color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-400' });
  }
  if (stats?.sessions?.some(s => s.scores.filler >= 90)) {
      dynamicAchievements.push({ title: '✨ Perfect Clarity', desc: 'Virtually zero filler words', color: 'from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-400' });
  }
  if (stats?.sessions?.some(s => s.scores.vocab >= 80)) {
      dynamicAchievements.push({ title: '📚 Vocabulary Builder', desc: 'Used strong transition words', color: 'from-emerald-500/10 to-green-500/10 border-emerald-500/20 text-emerald-400' });
  }
  
  if (dynamicAchievements.length === 0) {
      dynamicAchievements.push({ title: '🌱 Getting Started', desc: 'Complete sessions to unlock badges', color: 'from-gray-500/10 to-slate-500/10 border-gray-500/20 text-gray-400' });
  }

  return (
    <main className="min-h-screen pb-28 relative overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Soft green ambient background glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.12) 0%, rgba(34,197,94,0.04) 50%, transparent 70%)', filter: 'blur(90px)' }}
      />

      <div className="max-w-[1140px] mx-auto px-6 sm:px-8 pt-8 relative z-10 space-y-10">

        {/* ── SECTION 1 — Welcome Hero (Visual Focus) ── */}
        <section className="w-full rounded-[32px] p-8 sm:p-10 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-bold shadow-xs">
                <Sparkles size={15} className="text-emerald-400 fill-emerald-400 animate-pulse" />
                <span>{stats?.profile_badge || 'Speaking Mastery'}</span>
              </div>
              <h1 
                className="text-[36px] sm:text-[46px] font-[800] text-[var(--text-primary)] tracking-[-0.03em] leading-[1.1]"
                style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
              >
                Good Morning, {userName} 👋
              </h1>
              <p className="text-[17px] sm:text-[19px] text-[var(--text-secondary)] font-medium leading-relaxed">
                Built around your selected speaking goal. Ready for today's speaking challenge?
              </p>

              {/* Quick status chips */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)]">
                  <Flame size={16} className="text-orange-500 fill-orange-500" />
                  <span>Current streak: <strong className="text-orange-500">{streak} Days</strong></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)]">
                  <Target size={16} className="text-emerald-500" />
                  <span>Today's goal: <strong>1 Session</strong></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)]">
                  <Clock size={16} className="text-blue-500" />
                  <span>Est. practice remaining: <strong>3 mins</strong></span>
                </div>
              </div>
            </div>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3.5 shrink-0 min-w-[240px]">
              <button
                onClick={() => navigate('/session')}
                className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-[16px] text-black transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-emerald-500/20 group cursor-pointer"
                style={{ background: 'var(--accent)' }}
              >
                <Play size={18} className="fill-black transition-transform group-hover:scale-110" />
                <span>▶ Continue Practice</span>
              </button>

              <button
                onClick={() => navigate('/session')}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-[14px] text-[var(--text-primary)] bg-[var(--bg-hover)] border border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-card-hover)] active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <Mic size={16} className="text-[var(--text-secondary)]" />
                <span>Start New Session</span>
              </button>
            </div>
          </div>
        </section>


        {/* ── SECTION 2 — Today's Focus (Large Featured Card) ── */}
        <section className="w-full">
          <div className="rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                🎯 TODAY'S CHALLENGE
              </span>
              <h2 className="text-[28px] font-[800] text-[var(--text-primary)] tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {todayFocus.title}
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                {todayFocus.description}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[12px] font-bold text-[var(--text-secondary)] bg-[var(--bg-hover)] px-3 py-1 rounded-xl border border-[var(--border)] flex items-center gap-1">
                  <Clock size={13} className="text-[var(--text-tertiary)]" /> Estimated Time: {todayFocus.estimated_minutes} min
                </span>
                <span className="text-[12px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                  Confidence
                </span>
                <span className="text-[12px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/20">
                  Structure
                </span>
                <span className="text-[12px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-xl border border-purple-500/20">
                  Delivery
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/session')}
              className="px-8 py-4 rounded-2xl font-extrabold text-[15px] text-black transition-all duration-300 hover:scale-[1.04] active:scale-[0.98] shadow-md cursor-pointer shrink-0 w-full md:w-auto text-center"
              style={{ background: 'var(--accent)' }}
            >
              Start 🚀
            </button>
          </div>
        </section>


        {/* ── SECTION 3 — Quick Actions (4 Modern Cards) ── */}
        <section className="w-full">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-5 tracking-tight">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Start Session',
                desc: 'Launch custom AI speaking prompt',
                icon: Mic,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                onClick: () => navigate('/session'),
              },
              {
                title: 'Practice Drill',
                desc: 'Target specific vocal weaknesses',
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                onClick: () => navigate('/session'),
              },
              {
                title: 'View Progress',
                desc: 'See long-term growth trends',
                icon: BarChart2,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                onClick: () => navigate('/dashboard'),
              },
              {
                title: 'Review Last Session',
                desc: 'Revisit AI feedback report',
                icon: RefreshCw,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                onClick: () => {
                  if (latestSession) {
                    navigate(`/session/${latestSession.id}/results`);
                  } else {
                    navigate('/session');
                  }
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


        {/* ── 2 COLUMN GRID FOR SECTIONS 4, 6 & 8 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2 COLS: SECTION 4 — Recent Activity (Timeline Layout) */}
          <section className="lg:col-span-2 rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Clock size={20} className="text-emerald-500" /> Recent Activity
              </h3>
              <button 
                onClick={() => navigate('/session')}
                className="text-[13px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border)]">
              {stats?.sessions && stats.sessions.length > 0 ? (
                stats.sessions.slice(-3).reverse().map((act, idx) => {
                  const score = Math.round((act.scores.filler + act.scores.delivery + act.scores.structure + act.scores.vocab + act.scores.confidence) / 5);
                  let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  if (score >= 90) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  else if (score < 70) badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                  return (
                    <div key={idx} onClick={() => navigate(`/session/${act.id}/results`)} className="relative flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer">
                      <div className="absolute -left-[31px] w-5 h-5 rounded-full bg-[var(--bg-card)] border-4 border-emerald-500 shadow-xs" />
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{new Date(act.date).toLocaleDateString()}</span>
                        <h5 className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5 max-w-[200px] sm:max-w-[300px] truncate">{act.topic || 'Custom Practice'}</h5>
                      </div>
                      <span className={`px-3 py-1 rounded-xl border text-[13px] font-extrabold ${badgeColor}`}>
                        Score {score}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="relative flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                  <div className="absolute -left-[31px] w-5 h-5 rounded-full bg-[var(--bg-card)] border-4 border-[var(--border)] shadow-xs" />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Today</span>
                    <h5 className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5">No recent activity</h5>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT 1 COL: SECTION 6 (Weekly Goal) & SECTION 8 (Mini Insights) */}
          <div className="space-y-8">

            {/* SECTION 6 — Weekly Goal (Circular Progress Indicator) */}
            <section className="rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl text-center flex flex-col items-center">
              <h3 className="text-[18px] font-bold text-[var(--text-primary)] mb-4 tracking-tight">Weekly Goal</h3>
              
              {/* Circular SVG progress */}
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
                    className="text-emerald-500 transition-all duration-1000 stroke-round"
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
                  <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">{weeklyGoal.completed} / {weeklyGoal.target} Sessions</span>
                </div>
              </div>

              <p className="text-[12px] font-medium text-[var(--text-secondary)] mt-2 px-2">
                {weeklyGoal.remaining > 0 ? `Practice ${weeklyGoal.remaining} more session${weeklyGoal.remaining === 1 ? '' : 's'} to complete this week's goal.` : 'Weekly goal complete.'}
              </p>
            </section>

            {/* SECTION 8 — Mini Insights (Minimal Stat Chips) */}
            <section className="rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
              <h3 className="text-[18px] font-bold text-[var(--text-primary)] mb-4 tracking-tight flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" /> Mini Insights
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">Confidence</span>
                  <span className={`text-[16px] font-extrabold flex items-center gap-1 mt-1 ${getDiffColor(confidenceDiff)}`}>
                    {formatDiff(confidenceDiff)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">Vocabulary</span>
                  <span className={`text-[16px] font-extrabold flex items-center gap-1 mt-1 ${getDiffColor(vocabDiff)}`}>
                    {formatDiff(vocabDiff)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">Delivery</span>
                  <span className={`text-[16px] font-extrabold flex items-center gap-1 mt-1 ${getDiffColor(deliveryDiff)}`}>
                    {formatDiff(deliveryDiff)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase">Structure</span>
                  <span className={`text-[16px] font-extrabold flex items-center gap-1 mt-1 ${getDiffColor(structureDiff)}`}>
                    {formatDiff(structureDiff)}
                  </span>
                </div>
              </div>
            </section>

          </div>
        </div>


        {/* ── SECTION 5 — Achievements (Rewarding Badges) ── */}
        <section className="w-full">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-5 tracking-tight flex items-center gap-2">
            <Trophy size={20} className="text-amber-500 fill-amber-500" /> Achievements
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dynamicAchievements.map((ach, i) => (
              <div key={i} className={`p-5 rounded-[24px] bg-[var(--bg-card)] bg-gradient-to-br ${ach.color} border shadow-md flex items-center gap-4 hover:scale-[1.02] transition-transform`}>
                <div>
                  <h4 className="text-[15px] font-bold">{ach.title}</h4>
                  <p className="text-[11px] opacity-75 font-semibold mt-0.5 text-[var(--text-secondary)]">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ── SECTION 7 — Practice Suggestions ── */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">Suggested for You</h3>
            <span className="text-[12px] font-bold text-[var(--text-tertiary)]">Tailored to your journey</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ...dashboardSuggestions
            ].map((sug, i) => (
              <div 
                key={i} 
                onClick={() => navigate('/session')}
                className="p-6 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border)] shadow-md hover:shadow-xl hover:border-emerald-500/40 hover:bg-[var(--bg-hover)] transition-all cursor-pointer flex flex-col justify-between h-[180px] group"
              >
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-2xs">
                    {sug.tag}
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
            ))}
          </div>
        </section>


        {/* ── SECTION 9 — Upcoming Milestones ── */}
        <section className="w-full rounded-[28px] p-7 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-5 tracking-tight flex items-center gap-2">
            <Target size={20} className="text-emerald-500" /> Upcoming Milestones — Almost there!
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🥈', text: '2 sessions until a 7-day streak', progress: 70 },
              { icon: '⭐', text: '5 points until Silver Speaker', progress: 85 },
              { icon: '🚀', text: '3 sessions until Advanced Level', progress: 50 },
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[22px]">{m.icon}</span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)] leading-snug">{m.text}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ── SECTION 10 — Continue Learning (Large Bottom Card) ── */}
        <section className="w-full">
          <div className="rounded-[32px] p-8 sm:p-10 bg-[var(--bg-card)] border border-[var(--border)] text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                {latestSession ? 'LATEST SESSION' : 'START YOUR JOURNEY'}
              </span>
              <h3 className="text-[26px] sm:text-[30px] font-[800] tracking-tight text-[var(--text-primary)] mt-1 max-w-[600px] truncate" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {latestSession ? (latestSession.topic || 'Custom Speaking Drill') : 'Interview Practice'}
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                {latestSession ? `Completed on ${new Date(latestSession.date).toLocaleDateString()}` : 'Start your first 3-minute practice today.'}
              </p>
            </div>

            <button
              onClick={() => navigate('/session')}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-extrabold text-[16px] text-black transition-all shadow-lg active:scale-[0.98] cursor-pointer shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <span>Resume →</span>
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
