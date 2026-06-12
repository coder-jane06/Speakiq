import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
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
}

export default function DashboardPage() {
  const navigate = useNavigate();
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
      <div className="min-h-screen bg-primary text-secondary flex items-center justify-center">
        <p className="font-mono text-[14px]">Loading your progress...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 flex-col">
        <p className="text-[var(--red)] mb-4 font-bold">You have not completed any sessions yet.</p>
        <button onClick={() => navigate('/')} className="text-[var(--accent)] hover:underline font-bold">Go back to home</button>
      </div>
    );
  }

  const chartData = stats.sessions.map(s => ({
    name: `S${s.session_number}`,
    filler: s.scores.filler,
    delivery: s.scores.delivery,
    structure: s.scores.structure,
    vocab: s.scores.vocab,
    confidence: s.scores.confidence,
  }));

  // Best score improvement
  let bestImprovement = { key: '', change: -999 };
  Object.entries(stats.improvements || {}).forEach(([k, v]) => {
    if (v.change > bestImprovement.change) {
      bestImprovement = { key: k, change: v.change };
    }
  });

  return (
    <main className="min-h-screen bg-primary p-6 md:p-12 animate-fadeSlideUp">
      <div className="max-w-[1060px] mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-[36px] font-[700] text-primary tracking-tight mb-2">30-Day Progress</h1>
            <p className="text-secondary font-medium text-[16px]">Keep up the momentum!</p>
          </div>
        </header>

        {/* SECTION 1 - Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6">
            <h3 className="text-tertiary text-[12px] font-bold uppercase tracking-widest mb-2">Total Sessions</h3>
            <div className="text-[48px] font-bold text-primary leading-none">{stats.total_sessions}</div>
          </div>
          <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6">
            <h3 className="text-tertiary text-[12px] font-bold uppercase tracking-widest mb-2">Current Streak</h3>
            <div className="text-[48px] font-bold text-primary flex items-center gap-2 leading-none">
              {stats.current_streak} <span className="text-[var(--amber)]">🔥</span>
            </div>
            <div className="text-tertiary text-[12px] font-medium mt-3">Longest: {stats.longest_streak}</div>
          </div>
          <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6">
            <h3 className="text-tertiary text-[12px] font-bold uppercase tracking-widest mb-2">Top Improvement</h3>
            {bestImprovement.key && bestImprovement.change > -999 ? (
              <div className="text-[36px] font-bold text-[var(--accent)] capitalize leading-none mt-2">
                {bestImprovement.key} <span className="text-[18px] mt-1 block">+{bestImprovement.change}pts</span>
              </div>
            ) : (
              <div className="text-[24px] font-bold text-tertiary">-</div>
            )}
          </div>
        </div>

        {/* SECTION 2 - Score Trend Chart */}
        <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6">
          <h2 className="text-[18px] font-bold text-primary mb-6">Score Dimensions Trend</h2>
          <div className="h-80 w-full" style={{ background: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-md)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card-active)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="filler" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="delivery" stroke="var(--blue)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="structure" stroke="var(--amber)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="vocab" stroke="#A78BFA" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="confidence" stroke="var(--red)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SECTION 3 - Day 1 vs Today */}
          <div className="space-y-6">
            <h2 className="text-[18px] font-bold text-primary flex items-center justify-between">
              Growth Check
              <span className="text-tertiary text-[13px] font-medium">Day 1 vs Today</span>
            </h2>
            <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6 space-y-4">
              {Object.entries(stats.improvements || {}).map(([dim, val]) => (
                <div key={dim} className="flex items-center justify-between border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                  <span className="capitalize font-bold text-[14px] text-secondary w-1/3">{dim}</span>
                  <span className="text-secondary w-1/3 text-center text-[13px] font-mono">{Math.round(val.day1)} <span className="mx-1">→</span> {Math.round(val.today)}</span>
                  <span className={`w-1/3 text-right font-bold text-[14px] ${val.change >= 0 ? 'text-[var(--accent)]' : 'text-[var(--red)]'}`}>
                    {val.change > 0 ? '+' : ''}{Math.round(val.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4 - Top Fillers */}
          <div className="space-y-6">
            <h2 className="text-[18px] font-bold text-primary flex items-center justify-between">
              Top Fillers
              <span className="text-tertiary text-[13px] font-medium">All Time</span>
            </h2>
            <div className="card bg-[var(--bg-card)] border-[var(--border)] p-6 flex flex-wrap gap-3 content-start min-h-[160px]">
              {stats.top_fillers && stats.top_fillers.length > 0 ? stats.top_fillers.map((f, i) => (
                <div key={i} className="flex items-center bg-[var(--bg-hover)] border border-[var(--border-md)] rounded-full px-4 py-2">
                  <span className="text-[15px] font-bold text-primary mr-2">"{f.word}"</span>
                  <span className="bg-[var(--bg-card)] border border-[var(--border)] text-secondary text-[11px] font-bold py-1 px-2 rounded-full">{f.count}</span>
                </div>
              )) : (
                <p className="text-tertiary font-medium text-[14px] italic">No fillers detected yet! Great job.</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 5 - History */}
        <div className="space-y-6 pb-20">
          <h2 className="text-[18px] font-bold text-primary">Session History</h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden shadow-sm">
            {stats.sessions && stats.sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[var(--bg-hover)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-6 py-4 text-[12px] font-bold text-tertiary uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[12px] font-bold text-tertiary uppercase tracking-widest">Topic</th>
                      <th className="px-6 py-4 text-[12px] font-bold text-tertiary uppercase tracking-widest">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {[...stats.sessions].reverse().slice(0, 10).map((s) => {
                      const avg = Math.round((s.scores.filler + s.scores.delivery + s.scores.structure + s.scores.vocab + s.scores.confidence) / 5);
                      let scoreColor = 'bg-red-500/10 text-[var(--red)] border-red-500/20';
                      if (avg >= 80) scoreColor = 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--border-accent)]';
                      else if (avg >= 60) scoreColor = 'bg-amber-500/10 text-[var(--amber)] border-amber-500/20';
                      
                      return (
                        <tr key={s.session_number} onClick={() => navigate(`/session/${s.id}/results`)} className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group">
                          <td className="px-6 py-4 text-[13px] text-secondary font-medium">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-[14px] font-bold text-primary truncate max-w-[300px] group-hover:text-[var(--accent)] transition-colors">{s.topic || 'Custom Topic'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-bold border ${scoreColor}`}>
                              {avg}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-tertiary font-medium">No sessions yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}