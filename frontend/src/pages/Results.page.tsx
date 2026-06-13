import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoachingReport } from '../hooks/useCoachingReport'
import { ScoreRing }         from '../components/results/ScoreRing'
import { ROUTES, API_URL }   from '../constants'
import { supabase } from '../services/supabase'
import { useStreak } from '../hooks/useStreak'
import { ArrowLeft, CheckCircle2, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'

const SCORE_LABELS: Record<string, string> = {
  filler:     'Filler Words',
  delivery:   'Delivery',
  structure:  'Structure',
  vocab:      'Vocabulary',
  confidence: 'Confidence',
}

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate      = useNavigate()

  const { loading, error, session, coaching } = useCoachingReport(sessionId || 'latest')
  const { streakData } = useStreak()
  const [stats, setStats] = useState<any>(null)
  
  // For loading text progression
  const [loadingStage, setLoadingStage] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  // For celebration animation
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/dashboard/stats`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (res.ok) setStats(await res.json());
      } catch (err) { console.error(err) }
    };
    fetchStats();
  }, [])

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (elapsed < 7) setLoadingStage(0);
    else if (elapsed < 15) setLoadingStage(1);
    else if (elapsed < 21) setLoadingStage(2);
    else if (elapsed < 29) setLoadingStage(3);
    else setLoadingStage(4);
  }, [elapsed]);

  useEffect(() => {
    if (!loading && coaching) {
      // Trigger a small celebration animation when results finally appear
      setTimeout(() => setShowCelebration(true), 300);
    }
  }, [loading, coaching]);

  if (loading) {
    const stages = [
      { main: "Transcribing your words...", sub: "Converting speech to text" },
      { main: "Analyzing your delivery...", sub: "Checking pace, pitch and pauses" },
      { main: "Detecting patterns...", sub: "Finding filler words and structure" },
      { main: "Building your report...", sub: "Your AI coach is writing feedback" },
      { main: "Almost ready...", sub: "Finalizing your results" },
    ];
    
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 fixed inset-0 z-50"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="w-full max-w-[320px] flex flex-col items-center animate-fadeSlideUp">
          
          {/* Larger orb — 100px */}
          <div
            className="mb-10 flex items-center justify-center relative overflow-hidden"
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'var(--accent-glow)',
              border: '1px solid var(--border-md)',
              animation: 'pulse-orb 1.5s infinite ease-in-out',
            }}
          >
            {/* Outer ring glow */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)',
                opacity: 0.6,
              }}
            />
            <div
              className="rounded-full relative z-10"
              style={{
                width: '24px',
                height: '24px',
                background: 'var(--accent)',
                boxShadow: '0 0 28px var(--accent)',
              }}
            />
          </div>
          
          <h2
            className="text-[22px] font-bold text-center mb-2 h-8"
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              color: 'var(--text-primary)',
            }}
          >
            {stages[loadingStage].main}
          </h2>
          <p
            className="text-[15px] font-medium text-center mb-10 h-5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {stages[loadingStage].sub}
          </p>

          {/* 5 dots instead of 4 */}
          <div className="flex gap-3 mb-10 items-center">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i <= loadingStage ? '9px' : '6px',
                  height: i <= loadingStage ? '9px' : '6px',
                  background: i <= loadingStage ? 'var(--accent)' : 'var(--border-md)',
                  transform: i <= loadingStage ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: i <= loadingStage ? '0 0 8px var(--accent-glow)' : 'none',
                }}
              />
            ))}
          </div>

          <div
            className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {elapsed} SECONDS ELAPSED
          </div>

        </div>

        <style>{`
          @keyframes pulse-orb {
            0%, 100% { opacity: 0.8; transform: scale(1); }
            50%       { opacity: 1; transform: scale(1.08); }
          }
        `}</style>
      </main>
    )
  }

  if (error || !coaching || !session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div
          className="w-full max-w-sm text-center p-8 rounded-[var(--radius-xl)]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="text-4xl mb-4" style={{ color: 'var(--text-secondary)' }}>?</div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: 'var(--text-primary)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            Analysis Issue
          </h2>
          <p className="text-sm font-medium mb-8" style={{ color: 'var(--text-secondary)' }}>
            {error || 'Session not found'}
          </p>
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="w-full py-4 font-bold rounded-[var(--radius-md)] transition-all active:scale-95"
            style={{ background: 'var(--accent)', color: '#09090F' }}
          >
            Go home
          </button>
        </div>
      </main>
    )
  }

  const scores = (coaching.scores as Record<string, number>) || {}
  const scoreKeys = Object.keys(scores)
  
  let lowestKey = scoreKeys[0] || 'delivery';
  let lowestScore = scores[lowestKey] || 0;
  scoreKeys.forEach(k => {
    if (scores[k] < lowestScore) { lowestScore = scores[k]; lowestKey = k; }
  });

  // Calculate overall average
  const avgScore = Math.round(scoreKeys.reduce((acc, k) => acc + scores[k], 0) / scoreKeys.length) || 0;

  const getScoreColor = (score: number) => {
    if (score < 50) return { glow: 'var(--red)' };
    if (score <= 75) return { glow: 'var(--amber)' };
    return { glow: 'var(--accent)' };
  }
  const heroColor = getScoreColor(avgScore);

  let previousScores: Record<string, number> | null = null;
  if (stats?.sessions && stats.sessions.length > 1) {
    const sorted = [...stats.sessions].sort((a: any, b: any) => a.session_number - b.session_number);
    const currIdx = sorted.findIndex((s: any) => s.topic === (session as any).topic_text);
    if (currIdx > 0) {
      previousScores = sorted[currIdx - 1].scores;
    }
  }

  const streak = streakData?.current_streak || 0;
  const isFirstSession = (streakData?.total_sessions || 0) <= 1;
  let hookMessage = "";
  if (streak >= 3) {
    hookMessage = `🔥 ${streak}-day streak. You're on fire!`;
  } else if (isFirstSession) {
    hookMessage = "Day 1 of 30. The journey starts now.";
  } else if (previousScores && avgScore > (Object.values(previousScores).reduce((a,b)=>a+b,0)/5)) {
    hookMessage = `↑ You improved your average since yesterday. Brilliant.`;
  } else if (lowestScore % 10 >= 7) {
    hookMessage = `You're ${10 - (lowestScore % 10)} points away from your personal best. Tomorrow.`;
  } else {
    hookMessage = "Session complete. Get 1% better tomorrow.";
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-start pt-6 pb-28 px-6 overflow-x-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      
      {/* Gamification Confetti (CSS driven) */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center transition-opacity duration-1000 ${showCelebration ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className="rounded-full animate-pulse-orb"
          style={{
            width: '800px',
            height: '800px',
            background: 'var(--accent)',
            opacity: 0.05,
            filter: 'blur(100px)',
          }}
        />
      </div>

      <div className="w-full max-w-[1100px] flex flex-col relative z-10">

        {/* ← Back to Dashboard link */}
        <button
          onClick={() => navigate(ROUTES.DASHBOARD)}
          className="self-start flex items-center gap-2 mb-6 text-[13px] font-semibold transition-all duration-200"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back to Dashboard
        </button>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ── LEFT COLUMN (Scores & Metrics) ── */}
          <div className="w-full lg:w-[420px] flex flex-col gap-5 shrink-0">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h1
                className="text-[26px] font-[800] tracking-[-0.025em]"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                }}
              >
                Your Results
              </h1>
              <button
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="font-bold text-[14px] flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                Dashboard <ChevronRight size={16} />
              </button>
            </div>

            {/* Hero Score */}
            <div
              className="w-full rounded-[var(--radius-xl)] p-10 text-center flex flex-col items-center justify-center animate-cardEntrance relative overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              {/* Ambient glow behind ring */}
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{ background: `radial-gradient(circle at center, ${heroColor.glow} 0%, transparent 65%)` }}
              />
              
              <div
                className="text-[11px] tracking-[0.15em] uppercase font-bold mb-5 relative z-10"
                style={{ color: 'var(--text-secondary)' }}
              >
                Overall Score
              </div>
              
              <div className="relative z-10 mb-2">
                <ScoreRing score={avgScore} size={150} />
              </div>
              
              <div
                className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full relative z-10"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                }}
              >
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <span
                  className="font-bold text-[13px]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {hookMessage.replace('🔥 ', '')}
                </span>
              </div>
            </div>

            {/* Detailed Scores Ring Grid */}
            <div
              className="rounded-[var(--radius-xl)] p-6 opacity-0 animate-cardEntrance"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                animationDelay: '0.2s',
                animationFillMode: 'forwards',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <p
                  className="text-[11px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Metrics Breakdown
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-y-8 gap-x-2">
                {scoreKeys.map((key, idx) => {
                  const sc = scores[key] || 0;
                  let diffIcon = '—';
                  let diffColor = 'var(--text-tertiary)';
                  if (previousScores) {
                    const diff = sc - (previousScores[key] || 0);
                    if (diff > 0) { diffIcon = '↑'; diffColor = 'var(--accent)'; }
                    else if (diff < 0) { diffIcon = '↓'; diffColor = 'var(--red)'; }
                  }
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center opacity-0 animate-cardEntrance"
                      style={{
                        animationDelay: `${0.25 + idx * 0.07}s`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <div className="relative">
                        <ScoreRing score={sc} label="" size={80} />
                      </div>
                      <div
                        className="text-[11px] font-bold mt-3 mb-1 text-center leading-tight h-8 flex items-center justify-center"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {SCORE_LABELS[key] || key}
                      </div>
                      <div
                        className="text-[12px] font-bold font-mono px-2 py-0.5 rounded"
                        style={{
                          color: diffColor,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {diffIcon} {previousScores ? Math.abs(sc - (previousScores[key] || 0)) : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (Coaching Feedback) ── */}
          <div className="flex-1 flex flex-col gap-5 w-full lg:pt-[52px]">

            {/* Priority Fix */}
            <div
              className="rounded-[var(--radius-lg)] p-6 opacity-0 animate-cardEntrance relative overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                borderLeft: '4px solid var(--red)',
                border: '1px solid var(--border)',
                borderLeftWidth: '4px',
                borderLeftColor: 'var(--red)',
                animationDelay: '0.3s',
                animationFillMode: 'forwards',
              }}
            >
              {/* Subtle red bg gradient */}
              <div
                className="absolute inset-0 pointer-events-none rounded-[var(--radius-lg)]"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, transparent 50%)',
                }}
              />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}
                >
                  <TrendingUp size={17} strokeWidth={2.5} />
                </div>
                <span
                  className="font-bold uppercase tracking-[0.1em] text-[11px]"
                  style={{ color: 'var(--red)' }}
                >
                  Highest Priority Fix
                </span>
              </div>
              <p
                className="text-[15px] font-medium leading-[1.7] relative z-10"
                style={{ color: 'var(--text-primary)' }}
              >
                {(coaching.priority_fix as string)}
              </p>
            </div>

            {/* Thin divider */}
            <div
              className="w-full h-px opacity-40"
              style={{ background: 'var(--border)' }}
            />

            {/* What Went Well */}
            <div
              className="rounded-[var(--radius-lg)] p-6 opacity-0 animate-cardEntrance relative overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeftWidth: '4px',
                borderLeftColor: 'var(--accent)',
                animationDelay: '0.4s',
                animationFillMode: 'forwards',
              }}
            >
              {/* Subtle lime bg gradient */}
              <div
                className="absolute inset-0 pointer-events-none rounded-[var(--radius-lg)]"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-dim) 0%, transparent 55%)',
                  opacity: 0.6,
                }}
              />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  <Sparkles size={17} strokeWidth={2.5} />
                </div>
                <span
                  className="font-bold uppercase tracking-[0.1em] text-[11px]"
                  style={{ color: 'var(--accent)' }}
                >
                  What Went Well
                </span>
              </div>
              <p
                className="text-[15px] font-medium leading-[1.7] relative z-10"
                style={{ color: 'var(--text-primary)' }}
              >
                {(coaching.what_went_well as string)}
              </p>
            </div>

            {/* Thin divider */}
            <div
              className="w-full h-px opacity-40"
              style={{ background: 'var(--border)' }}
            />

            {/* Content & Ideas */}
            <div
              className="rounded-[var(--radius-lg)] p-6 opacity-0 animate-cardEntrance relative overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeftWidth: '4px',
                borderLeftColor: 'var(--blue)',
                animationDelay: '0.5s',
                animationFillMode: 'forwards',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="font-bold uppercase tracking-[0.1em] text-[11px]"
                  style={{ color: 'var(--blue)' }}
                >
                  Content &amp; Ideas
                </span>
              </div>
              <p
                className="text-[15px] font-medium leading-[1.7]"
                style={{ color: 'var(--text-primary)' }}
              >
                {(coaching.content_feedback as string)}
              </p>
            </div>

            {/* Interactive Drill */}
            <div
              className="opacity-0 animate-cardEntrance mt-1"
              style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
            >
              <InteractiveDrillCard
                sessionId={session.id}
                drill={(coaching.daily_drill as string) || "Focus on pausing during important points"}
              />
            </div>

          </div>

        </div>
      </div>

      <style>{`
        @keyframes pulse-orb {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50%       { opacity: 0.08; transform: scale(1.04); }
        }
      `}</style>
    </main>
  )
}

function InteractiveDrillCard({ sessionId, drill }: { sessionId: string, drill: string }) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const markPracticed = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/dashboard/complete-drill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          session_id: sessionId,
          drill_text: drill,
          drill_type: 'daily_drill',
        }),
      });
      if (!res.ok) throw new Error('Failed to save drill completion');
      setDone(true);
    } catch (err) {
      console.error('[Results] Failed to save drill completion:', err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div
      className="card-interactive p-6 transition-all duration-500 overflow-hidden relative"
      style={{
        background: done ? 'var(--accent-dim)' : 'var(--bg-card)',
        border: done ? '1px solid var(--border-md)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
       
       {done && (
         <div
           className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full pointer-events-none animate-scale-pop"
           style={{
             background: 'var(--accent)',
             opacity: 0.18,
             filter: 'blur(30px)',
           }}
         />
       )}

       <div className="flex items-center gap-3 mb-4 relative z-10">
          <span
            className="font-bold uppercase tracking-[0.1em] text-[11px] transition-colors"
            style={{ color: done ? 'var(--accent)' : 'var(--text-tertiary)' }}
          >
            Daily Action Item
          </span>
       </div>
       
       <p
         className="font-medium text-[16px] leading-[1.7] mb-6 relative z-10"
         style={{ color: 'var(--text-primary)' }}
       >
         {drill}
       </p>
       
       <button 
         onClick={markPracticed}
         disabled={done || saving}
         className="relative z-10 w-full md:w-auto px-8 py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 active:scale-95"
         style={done ? {
           background: 'var(--accent)',
           color: '#09090F',
           boxShadow: '0 0 20px var(--accent-glow)',
         } : {
           background: 'var(--bg-base)',
           color: 'var(--text-primary)',
           border: '1px solid var(--border)',
         }}
       >
         {done ? (
           <>
             <CheckCircle2 size={18} strokeWidth={2.5} />
             Completed
           </>
         ) : (
           saving ? 'Saving...' : 'Mark as practiced'
         )}
       </button>
    </div>
  )
}
