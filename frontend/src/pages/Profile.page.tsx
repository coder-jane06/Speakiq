import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES, API_URL } from '../constants';
import { supabase } from '../services/supabase';
import { LogOut, Flame, Star, Mic, Trophy, Calendar, TrendingUp } from 'lucide-react';

interface ProfileStats {
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  sessions?: any[];
  best_session?: any;
}

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
        const res = await fetch(`${API_URL}/api/dashboard/stats`, {
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

  const currentStreak = stats?.current_streak || 0;
  const longestStreak = stats?.longest_streak || 0;
  const totalSessions = stats?.total_sessions || 0;
  const bestAvg = stats?.best_session
    ? Math.round(Object.values(stats.best_session.scores || {}).reduce((a: any, b: any) => a + b, 0) as number / 5)
    : 0;

  // Calculate member since from user metadata
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <main className="min-h-[85vh] flex flex-col items-center px-6 py-10 bg-[var(--bg-base)] animate-fadeSlideUp">
      <div className="w-full max-w-[960px] flex flex-col">

        {/* ── Profile Header ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-12 bg-[var(--bg-card)] p-8 md:p-10 rounded-[28px] border border-[var(--border)] relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--accent)]/[0.04] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>

          {/* Avatar */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-[22px] bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/20 flex items-center justify-center relative z-10 text-[36px] md:text-[42px] font-bold text-[var(--accent)] shadow-[0_0_40px_rgba(200,249,125,0.08)]">
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </div>

          {/* Info */}
          <div className="relative z-10 flex-1">
            <h1 className="text-[28px] md:text-[34px] font-[700] text-primary mb-1.5 tracking-[-0.02em] leading-tight">Your Profile</h1>
            <p className="text-[15px] text-[var(--text-secondary)] font-medium mb-1">{user?.email || 'Unknown'}</p>
            <p className="text-[13px] text-[var(--text-tertiary)]">Member since {memberSince}</p>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="relative z-10 flex items-center gap-2 h-[44px] px-6 rounded-[14px] bg-red-500/8 text-red-400 font-semibold text-[14px] border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 active:scale-[0.97] transition-all"
          >
            <LogOut size={16} strokeWidth={2.5} />
            Sign Out
          </button>
        </div>

        {/* ── Stats Grid ── */}
        <h2 className="text-[20px] font-[700] text-primary mb-5 tracking-[-0.01em]">Your Progress</h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatTile
            icon={<Flame size={22} strokeWidth={2.5} />}
            title="Current Streak"
            value={loading ? '–' : `${currentStreak}`}
            unit="days"
            accent={currentStreak > 0 ? 'orange' : 'muted'}
          />
          <StatTile
            icon={<Star size={22} strokeWidth={2.5} />}
            title="Longest Streak"
            value={loading ? '–' : `${longestStreak}`}
            unit="days"
            accent="amber"
          />
          <StatTile
            icon={<Mic size={22} strokeWidth={2.5} />}
            title="Total Sessions"
            value={loading ? '–' : `${totalSessions}`}
            unit="completed"
            accent="green"
          />
          <StatTile
            icon={<Trophy size={22} strokeWidth={2.5} />}
            title="Best Score"
            value={loading ? '–' : totalSessions > 0 ? `${bestAvg}` : '–'}
            unit="avg"
            accent="blue"
          />
        </div>

        {/* ── Activity Summary ── */}
        <h2 className="text-[20px] font-[700] text-primary mb-5 tracking-[-0.01em]">Activity</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[20px] p-6 flex items-start gap-4 hover:border-[var(--border-md)] transition-colors">
            <div className="w-10 h-10 rounded-[12px] bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Calendar size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[13px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mb-1">Consistency</p>
              <p className="text-primary font-medium text-[15px] leading-relaxed">
                {totalSessions === 0
                  ? "Start your first session to begin tracking."
                  : currentStreak > 0
                    ? `You're on a ${currentStreak}-day streak. Keep going!`
                    : "Your streak reset. Start a session today to rebuild it."}
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[20px] p-6 flex items-start gap-4 hover:border-[var(--border-md)] transition-colors">
            <div className="w-10 h-10 rounded-[12px] bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <TrendingUp size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[13px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mb-1">Improvement</p>
              <p className="text-primary font-medium text-[15px] leading-relaxed">
                {totalSessions < 2
                  ? "Complete 2+ sessions to start seeing trends."
                  : `Your best average score is ${bestAvg}. Check the dashboard for detailed trends.`}
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

function StatTile({ icon, title, value, unit, accent }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit: string;
  accent: 'orange' | 'amber' | 'green' | 'blue' | 'muted';
}) {
  const colors = {
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', value: 'text-orange-400' },
    amber:  { bg: 'bg-amber-400/10',  text: 'text-amber-400',  value: 'text-amber-400' },
    green:  { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', value: 'text-[var(--accent)]' },
    blue:   { bg: 'bg-blue-400/10',   text: 'text-blue-400',   value: 'text-blue-400' },
    muted:  { bg: 'bg-white/5',        text: 'text-[var(--text-tertiary)]', value: 'text-[var(--text-tertiary)]' },
  };
  const c = colors[accent];

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[20px] p-5 md:p-6 flex flex-col hover:border-[var(--border-md)] transition-colors group">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${c.bg} ${c.text}`}>
          {icon}
        </div>
        <span className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider leading-tight">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-auto">
        <span className={`text-[36px] font-[700] font-mono tracking-[-0.04em] leading-none ${c.value}`}>{value}</span>
        <span className="text-[13px] font-medium text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}