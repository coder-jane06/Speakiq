import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';
import { useNavigate } from 'react-router-dom';
import { Mic, Trophy, ArrowRight } from 'lucide-react';

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

const DIMENSION_COLORS: Record<string, string> = {
  filler:     'var(--accent)',
  delivery:   'var(--blue)',
  structure:  'var(--amber)',
  vocab:      '#A78BFA',
  confidence: 'var(--teal)',
};



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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--border-md)] border-t-[var(--accent)] animate-spin" />
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Loading your progress…</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.total_sessions === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="text-center flex flex-col items-center gap-5 max-w-sm">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center text-[28px]"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            🎙️
          </div>
          <div>
            <p
              className="text-[22px] font-bold mb-2 tracking-tight"
              style={{ fontFamily: '"Bricolage Grotesque", sans-serif', color: 'var(--text-primary)' }}
            >
              No sessions yet
            </p>
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              Complete your first session to start seeing your analytics.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
          >
            Start a Session <ArrowRight size={15} />
          </button>
        </div>
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

  // Latest session scores for dimension panel
  const latestSession = stats.sessions.length > 0
    ? stats.sessions[stats.sessions.length - 1]
    : null;

  const latestScores: Record<string, number> = latestSession
    ? {
        filler:     latestSession.scores.filler,
        delivery:   latestSession.scores.delivery,
        structure:  latestSession.scores.structure,
        vocab:      latestSession.scores.vocab,
        confidence: latestSession.scores.confidence,
      }
    : {};

  const bestAvg = stats.best_session?.avg_score
    ? Math.round(stats.best_session.avg_score)
    : 0;

  return (
    <main
      className="min-h-screen animate-fadeSlideUp"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10">

        {/* ── Header ── */}
        <header className="flex justify-between items-start mb-10">
          <div>
            <h1
              className="text-[36px] font-[700] tracking-tight leading-none mb-2"
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                color: 'var(--text-primary)',
              }}
            >
              Your Progress
            </h1>
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Keep the momentum going 🚀
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[0.97]"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
          >
            New Session <ArrowRight size={14} />
          </button>
        </header>

        {/* ── 2-Column Body ── */}
        <div className="flex gap-8 items-start">

          {/* ── LEFT PANEL ── */}
          <aside className="w-[260px] shrink-0 flex flex-col gap-4 sticky top-6">

            {/* Streak Tile */}
            <div
              className="rounded-[18px] p-5 border transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[22px]">🔥</span>
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Streak
                </span>
              </div>
              <div
                className="text-[40px] font-[700] leading-none mb-1 tracking-tight"
                style={{
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                  color: 'var(--text-primary)',
                }}
              >
                {stats.current_streak}
              </div>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                day streak · longest {stats.longest_streak}
              </p>
            </div>

            {/* Sessions Tile */}
            <div
              className="rounded-[18px] p-5 border transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  <Mic size={13} strokeWidth={2.5} />
                </div>
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Sessions
                </span>
              </div>
              <div
                className="text-[40px] font-[700] leading-none mb-1 tracking-tight"
                style={{
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                  color: 'var(--text-primary)',
                }}
              >
                {stats.total_sessions}
              </div>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                sessions completed
              </p>
            </div>

            {/* Best Score Tile */}
            <div
              className="rounded-[18px] p-5 border transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'rgba(96,165,250,0.12)', color: 'var(--blue)' }}
                >
                  <Trophy size={13} strokeWidth={2.5} />
                </div>
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Best Avg
                </span>
              </div>
              <div
                className="text-[40px] font-[700] leading-none mb-1 tracking-tight"
                style={{
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                  color: bestAvg >= 80 ? 'var(--accent)' : bestAvg >= 60 ? 'var(--amber)' : 'var(--text-primary)',
                }}
              >
                {bestAvg > 0 ? bestAvg : '–'}
              </div>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                best avg score
              </p>
            </div>

            {/* Dimension Scores */}
            <div
              className="rounded-[18px] p-5 border transition-colors duration-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.12em] mb-4"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Skill Dimensions
              </p>
              <div className="flex flex-col gap-3">
                {(['filler', 'delivery', 'structure', 'vocab', 'confidence'] as const).map((dim) => {
                  const score = latestScores[dim];
                  return (
                    <div key={dim} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: DIMENSION_COLORS[dim] }}
                        />
                        <span
                          className="text-[13px] font-medium capitalize"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {dim}
                        </span>
                      </div>
                      <span
                        className="text-[12px] font-bold px-2 py-0.5 rounded-[6px]"
                        style={{
                          background: score !== undefined ? `${DIMENSION_COLORS[dim]}18` : 'var(--bg-hover)',
                          color: score !== undefined ? DIMENSION_COLORS[dim] : 'var(--text-tertiary)',
                        }}
                      >
                        {score !== undefined ? Math.round(score) : '–'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {latestSession && (
                <p className="text-[11px] mt-4 pt-3 border-t" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}>
                  From session #{latestSession.session_number}
                </p>
              )}
            </div>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <div className="flex-1 flex flex-col gap-8 min-w-0">

            {/* Score Trend Chart */}
            <div
              className="rounded-[18px] border p-6"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <h2
                className="text-[16px] font-[700] mb-5"
                style={{
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                  color: 'var(--text-primary)',
                }}
              >
                Score Trends
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-md)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-tertiary)"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="var(--text-tertiary)"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}
                    />
                    <Line type="monotone" dataKey="filler"     stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--accent)' }}     activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="delivery"   stroke="var(--blue)"   strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--blue)' }}       activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="structure"  stroke="var(--amber)"  strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--amber)' }}      activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="vocab"      stroke="#A78BFA"       strokeWidth={2.5} dot={{ r: 3.5, fill: '#A78BFA' }}           activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="confidence" stroke="var(--teal)"   strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--teal)' }}       activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Growth Check + Top Fillers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Growth Check */}
              <div
                className="rounded-[18px] border p-6"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-[16px] font-[700]"
                    style={{
                      fontFamily: '"Bricolage Grotesque", sans-serif',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Growth Check
                  </h2>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    style={{
                      color: 'var(--text-tertiary)',
                      borderColor: 'var(--border)',
                      background: 'var(--bg-hover)',
                    }}
                  >
                    Day 1 → Today
                  </span>
                </div>
                <div className="flex flex-col gap-0 divide-y" style={{ borderColor: 'var(--border)' }}>
                  {Object.entries(stats.improvements || {}).map(([dim, val]) => (
                    <div key={dim} className="flex items-center justify-between py-3">
                      <span
                        className="capitalize text-[13px] font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {dim}
                      </span>
                      <span
                        className="text-[12px] font-mono"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {Math.round(val.day1)} → {Math.round(val.today)}
                      </span>
                      <span
                        className="text-[12px] font-bold px-2 py-0.5 rounded-[6px]"
                        style={{
                          color: val.change >= 0 ? 'var(--accent)' : 'var(--red)',
                          background: val.change >= 0 ? 'var(--accent-dim)' : 'rgba(239,68,68,0.1)',
                        }}
                      >
                        {val.change > 0 ? '+' : ''}{Math.round(val.change)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Fillers */}
              <div
                className="rounded-[18px] border p-6"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-[16px] font-[700]"
                    style={{
                      fontFamily: '"Bricolage Grotesque", sans-serif',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Top Fillers
                  </h2>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    style={{
                      color: 'var(--text-tertiary)',
                      borderColor: 'var(--border)',
                      background: 'var(--bg-hover)',
                    }}
                  >
                    All Time
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5 content-start min-h-[120px]">
                  {stats.top_fillers && stats.top_fillers.length > 0
                    ? stats.top_fillers.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px]"
                          style={{
                            background: 'var(--bg-hover)',
                            borderColor: 'var(--border-md)',
                          }}
                        >
                          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            "{f.word}"
                          </span>
                          <span
                            className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--accent-dim)',
                              color: 'var(--accent)',
                            }}
                          >
                            {f.count}
                          </span>
                        </div>
                      ))
                    : (
                        <p
                          className="text-[14px] italic"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          No fillers detected yet! Great job. 🎉
                        </p>
                      )}
                </div>
              </div>
            </div>

            {/* Session History */}
            <div
              className="rounded-[18px] border overflow-hidden"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <h2
                  className="text-[16px] font-[700]"
                  style={{
                    fontFamily: '"Bricolage Grotesque", sans-serif',
                    color: 'var(--text-primary)',
                  }}
                >
                  Session History
                </h2>
                {stats.sessions.length > 10 && (
                  <button
                    className="text-[12px] font-semibold transition-colors duration-150"
                    style={{ color: 'var(--accent)' }}
                    onClick={() => {}}
                  >
                    View all →
                  </button>
                )}
              </div>

              {stats.sessions && stats.sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead
                      className="border-b"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                    >
                      <tr>
                        <th
                          className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Date
                        </th>
                        <th
                          className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Topic
                        </th>
                        <th
                          className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Avg Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.sessions].reverse().slice(0, 10).map((s) => {
                        const avg = Math.round(
                          (s.scores.filler + s.scores.delivery + s.scores.structure + s.scores.vocab + s.scores.confidence) / 5
                        );
                        let scoreBg = 'rgba(239,68,68,0.1)';
                        let scoreColor = 'var(--red)';
                        if (avg >= 80) { scoreBg = 'var(--accent-dim)'; scoreColor = 'var(--accent)'; }
                        else if (avg >= 60) { scoreBg = 'rgba(251,191,36,0.1)'; scoreColor = 'var(--amber)'; }

                        return (
                          <tr
                            key={s.session_number}
                            onClick={() => navigate(`/session/${s.id}/results`)}
                            className="border-b cursor-pointer transition-colors duration-150 group"
                            style={{ borderColor: 'var(--border)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td
                              className="px-6 py-4 text-[13px] font-medium"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {new Date(s.date).toLocaleDateString()}
                            </td>
                            <td
                              className="px-6 py-4 text-[14px] font-semibold truncate max-w-[260px] transition-colors duration-150 group-hover:text-[var(--accent)]"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {s.topic || 'Custom Topic'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-[8px] text-[12px] font-bold"
                                style={{ background: scoreBg, color: scoreColor }}
                              >
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
                <div
                  className="p-10 text-center text-[14px] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  No sessions yet.
                </div>
              )}
            </div>

          </div>
          {/* end main content */}
        </div>
        {/* end 2-col body */}

      </div>
    </main>
  );
}