import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../constants';
import { supabase } from '../services/supabase';
import { 
  Flame, Trophy, Mic, Clock, Calendar, TrendingUp, 
  Edit3, Share2, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';

interface ProfileStats {
  display_name?: string;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  sessions?: any[];
  best_session?: any;
}



export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
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

  const handleShareProfile = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentStreak  = stats?.current_streak || 5;
  const totalSessions  = stats?.total_sessions || 48;
  const bestAvg        = stats?.best_session?.avg_score
    ? Math.round(stats.best_session.avg_score)
    : 96;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Unknown';

  const rawSessions = (stats?.sessions && stats.sessions.length > 0) 
    ? [...stats.sessions].reverse() 
    : [];
  
  // Calculate dynamic stats
  const validSessions = rawSessions.filter((s: any) => s.scores);
  const totalScoreCount = validSessions.length;
  const overallAvgScore = totalScoreCount > 0 
    ? Math.round(validSessions.reduce((acc, s) => {
        const sc = s.scores;
        return acc + ((sc.filler + sc.delivery + sc.structure + sc.vocab + sc.confidence) / 5);
      }, 0) / totalScoreCount)
    : 0;

  const totalPracticeSeconds = rawSessions.reduce((acc: number, s: any) => acc + (s.duration_secs || 0), 0);
  const practiceMinutes = Math.round(totalPracticeSeconds / 60) || Math.round(totalSessions * 3); // Fallback if old data doesn't have duration_secs
  const uniqueDays = new Set(rawSessions.map((s: any) => s.date)).size || 1;

  // Radar logic
  const radarAverages = {
    confidence: 0, delivery: 0, vocab: 0, structure: 0, filler: 0
  };
  if (totalScoreCount > 0) {
    validSessions.forEach(s => {
      radarAverages.confidence += s.scores.confidence;
      radarAverages.delivery += s.scores.delivery;
      radarAverages.vocab += s.scores.vocab;
      radarAverages.structure += s.scores.structure;
      radarAverages.filler += s.scores.filler;
    });
    for (const key in radarAverages) {
      (radarAverages as any)[key] = Math.round((radarAverages as any)[key] / totalScoreCount);
    }
  }

  // Milestones Progress
  const ms1 = Math.min(100, Math.round((totalSessions / 50) * 100));
  const ms2 = Math.min(100, Math.round((practiceMinutes / 100) * 100));
  const ms3 = Math.min(100, Math.round((currentStreak / 7) * 100));
  const ms4 = Math.min(100, Math.round((bestAvg / 100) * 100));

  // Dynamic Achievements
  const unlockedAchievements = [];
  if (radarAverages.delivery >= 80 && radarAverages.confidence >= 80) {
    unlockedAchievements.push({ icon: '🏆', title: 'Strong Communicator', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '🏆', title: 'Strong Communicator', unlocked: false, progress: 'Need 80+ Delivery' });
  }
  
  if (radarAverages.structure >= 85) {
    unlockedAchievements.push({ icon: '🎯', title: 'Interview Master', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '🎯', title: 'Interview Master', unlocked: false, progress: 'Need 85+ Structure' });
  }

  if (currentStreak >= 7) {
    unlockedAchievements.push({ icon: '🔥', title: '7-Day Streak', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '🔥', title: '7-Day Streak', unlocked: false, progress: `${currentStreak} / 7 Days` });
  }

  if (radarAverages.vocab >= 80) {
    unlockedAchievements.push({ icon: '📚', title: 'Vocabulary Builder', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '📚', title: 'Vocabulary Builder', unlocked: false, progress: 'Need 80+ Vocab' });
  }

  if (totalSessions >= 50) {
    unlockedAchievements.push({ icon: '🎤', title: '50 Sessions', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '🎤', title: '50 Sessions', unlocked: false, progress: `${totalSessions} / 50` });
  }

  if (radarAverages.filler >= 90) {
    unlockedAchievements.push({ icon: '⚡', title: 'Zero Filler Master', unlocked: true, date: 'Unlocked recently' });
  } else {
    unlockedAchievements.push({ icon: '⚡', title: 'Zero Filler Master', unlocked: false, progress: 'Need 90+ Filler Control' });
  }
  const unlockedCount = unlockedAchievements.filter(a => a.unlocked).length;

  const displayedSessions = showAllSessions ? rawSessions : rawSessions.slice(0, 4);

  const initials = user?.email?.charAt(0).toUpperCase() || 'G';
  const displayName = stats?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const username = `@${user?.email?.split('@')[0] || 'user'}`;

  const userLevel = totalSessions >= 15 ? 'Advanced' : totalSessions >= 5 ? 'Intermediate' : 'Beginner';
  const currentXP = totalSessions * 140 + currentStreak * 65 + 320;
  const nextLevelXP = 5000;
  const xpPercentage = Math.min(100, Math.round((currentXP / nextLevelXP) * 100));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <main
      className="min-h-screen pb-32 animate-fadeSlideUp relative"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Soft Ambient Glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full pointer-events-none z-0 opacity-20"
        style={{ background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', filter: 'blur(130px)' }}
      />

      <div className="max-w-[960px] mx-auto px-5 sm:px-8 pt-10 relative z-10 space-y-14">

        {/* ── SECTION 1 — PROFILE HERO ── */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div 
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-[22px] flex items-center justify-center text-[34px] font-black shrink-0 aspect-square shadow-md border"
              style={{
                background: 'var(--accent)',
                borderColor: 'var(--border-md)',
                fontFamily: '"Bricolage Grotesque", sans-serif'
              }}
            >
              <span className="text-black">{initials}</span>
            </div>

            {/* Identity & Specs */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 
                  className="text-[28px] sm:text-[34px] font-[800] tracking-tight leading-none text-[var(--text-primary)]"
                  style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
                >
                  {displayName}
                </h1>
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)] flex items-center gap-1.5">
                  <Flame size={13} className="fill-current" /> {currentStreak}-Day Streak
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-[var(--text-secondary)] font-medium">
                <span className="text-[var(--text-primary)] font-semibold">{username}</span>
                <span className="text-[var(--text-tertiary)]">•</span>
                <span>{user?.email || 'user@example.com'}</span>
                <span className="text-[var(--text-tertiary)]">•</span>
                <span className="text-[var(--text-tertiary)]">Member since {memberSince}</span>
              </div>

              {/* XP Progress & Level */}
              <div className="pt-2 flex items-center gap-4 text-[12px]">
                <span className="font-bold text-[var(--text-primary)]">{userLevel} Speaker</span>
                <div className="w-44 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden p-[1px] border border-[var(--border)]">
                  <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-700 shadow-xs" style={{ width: `${xpPercentage}%` }} />
                </div>
                <span className="text-[var(--text-tertiary)] font-medium">{currentXP} / {nextLevelXP} XP</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2.5 rounded-[14px] font-extrabold text-[13px] bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition-all cursor-pointer shadow-xs flex items-center gap-2"
            >
              <Edit3 size={15} />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={handleShareProfile}
              className="px-4 py-2.5 rounded-[14px] font-bold text-[13px] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Share2 size={15} />
              <span>{copiedLink ? 'Copied!' : 'Share Profile'}</span>
            </button>
          </div>
        </section>


        {/* ── SECTION 2 — QUICK STATISTICS ── */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">Quick Statistics</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {[
              { label: 'Current Streak', val: `${currentStreak} Days`, icon: Flame },
              { label: 'Best Score', val: `${bestAvg}`, icon: Trophy },
              { label: 'Sessions Completed', val: `${totalSessions}`, icon: Mic },
              { label: 'Practice Minutes', val: `${practiceMinutes}m`, icon: Clock },
              { label: 'Days Active', val: `${uniqueDays}`, icon: Calendar },
              { label: 'Average Score', val: `${overallAvgScore}`, icon: TrendingUp },
            ].map((st, i) => {
              const Icon = st.icon;
              return (
                <div 
                  key={i} 
                  className="p-5 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all duration-300 shadow-xs flex flex-col justify-between min-h-[125px] group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[var(--text-tertiary)]">
                    <Icon size={16} className="group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                  <div>
                    <div 
                      className="text-[26px] font-[800] text-[var(--text-primary)] leading-none"
                      style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
                    >
                      {st.val}
                    </div>
                    <p className="text-[11px] font-bold text-[var(--text-tertiary)] mt-1.5 truncate">{st.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        {/* ── SECTION 3 — ACHIEVEMENTS ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">Achievements</h2>
            <span className="text-[12px] text-[var(--text-tertiary)] font-medium">{unlockedCount} of {unlockedAchievements.length} Unlocked</span>
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto pb-2 scrollbar-none">
            {unlockedAchievements.map((ach, i) => (
              <div 
                key={i}
                className={`shrink-0 px-5 py-4 rounded-[22px] border flex items-center gap-3.5 transition-all ${ach.unlocked ? 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] shadow-xs' : 'bg-[var(--bg-card)]/40 border-[var(--border)]/40 opacity-50'}`}
              >
                <span className="text-[24px]">{ach.icon}</span>
                <div>
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)] whitespace-nowrap">{ach.title}</h4>
                  <span className="text-[11px] font-semibold text-[var(--accent)]">
                    {ach.unlocked ? ach.date : ach.progress}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ── SECTION 4 — SPEAKING PROFILE ── */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">Speaking Profile</h2>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] p-6 sm:p-8 space-y-5 shadow-xs">
            {[
              { key: 'confidence', label: 'Confidence' },
              { key: 'delivery', label: 'Delivery' },
              { key: 'vocab', label: 'Vocabulary' },
              { key: 'structure', label: 'Structure' },
              { key: 'filler', label: 'Filler Control' },
            ].map(sk => {
              const score = (radarAverages as any)[sk.key] || 0;
              const status = score >= 85 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 55 ? 'Good' : score > 0 ? 'Improving' : 'Needs Data';

              return (
                <div key={sk.key} className="space-y-2">
                  <div className="flex justify-between items-center text-[13px] font-bold">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[var(--text-primary)]">{sk.label}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)]">
                        {status}
                      </span>
                    </div>
                    <span className="text-[var(--text-primary)] font-extrabold">{score}%</span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[var(--bg-hover)] overflow-hidden p-[1px] border border-[var(--border)]">
                    <div 
                      className="h-full bg-[var(--accent)] rounded-full transition-all duration-1000 shadow-xs" 
                      style={{ width: `${score}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        {/* ── SECTION 5 — SESSION HISTORY ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">Session History</h2>
            <span className="text-[12px] text-[var(--text-tertiary)] font-medium">{rawSessions.length} sessions logged</span>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] divide-y divide-[var(--border)] overflow-hidden shadow-xs">
            {displayedSessions.length > 0 ? displayedSessions.map((s: any) => {
              const avg = s.scores
                ? Math.round((s.scores.filler + s.scores.delivery + s.scores.structure + s.scores.vocab + s.scores.confidence) / 5)
                : 75;

              return (
                <div 
                  key={s.id || s.session_number}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors group cursor-pointer"
                  onClick={() => navigate(`/session/${s.id}/results`)}
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <h4 className="text-[15px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {s.topic || 'Custom Speaking Drill'}
                    </h4>
                    <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-tertiary)] font-medium">
                      <span>{s.date ? (s.date.includes('-') ? new Date(s.date).toLocaleDateString() : s.date) : 'Recently'}</span>
                      <span>•</span>
                      <span>{s.duration_secs ? Math.round(s.duration_secs / 60) : 3} mins duration</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[15px] font-black text-[var(--text-primary)]">
                      {avg} <span className="text-[11px] font-normal text-[var(--text-tertiary)]">pts</span>
                    </span>
                    <button className="text-[12px] font-bold text-[var(--accent)] hover:underline flex items-center gap-0.5 cursor-pointer">
                      <span>View Report</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <p className="text-[15px] font-bold">No sessions yet</p>
                <p className="text-[13px] mt-1">Start a practice session to see your history here.</p>
              </div>
            )}

            {/* Toggle Button */}
            {rawSessions.length > 4 && (
              <div className="p-3.5 bg-[var(--bg-hover)] text-center border-t border-[var(--border)]">
                <button
                  onClick={() => setShowAllSessions(!showAllSessions)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[12px] font-extrabold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer shadow-2xs"
                >
                  <span>{showAllSessions ? 'Collapse History' : `View All ${rawSessions.length} Sessions`}</span>
                  {showAllSessions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            )}
          </div>
        </section>


        {/* ── SECTION 6 — PERSONAL MILESTONES ── */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">Personal Milestones</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {[
              { title: '50 Sessions', desc: `${totalSessions} of 50 completed`, icon: Mic, progress: `${ms1}%` },
              { title: '100 Minutes Practiced', desc: `${practiceMinutes} mins completed`, icon: Clock, progress: `${ms2}%` },
              { title: '7-Day Streak', desc: `${currentStreak} of 7 days active`, icon: Flame, progress: `${ms3}%` },
              { title: 'Highest Score', desc: `${bestAvg} pts achieved`, icon: Trophy, progress: `${ms4}%` },
            ].map((ms, i) => {
              const Icon = ms.icon;
              return (
                <div 
                  key={i} 
                  className="p-5 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all duration-300 shadow-xs flex flex-col justify-between min-h-[135px] group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)] flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <span className="text-[12px] font-black text-[var(--text-primary)]">{ms.progress}</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[15px] font-bold text-[var(--text-primary)] leading-snug">{ms.title}</h4>
                    <p className="text-[12px] font-medium text-[var(--text-secondary)]">{ms.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}