import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoachingReport } from '../hooks/useCoachingReport'
import { ScoreRing }         from '../components/results/ScoreRing'
import { ROUTES, API_URL }   from '../constants'
import { supabase } from '../services/supabase'
import { useStreak } from '../hooks/useStreak'
import { CheckCircle2, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'

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
        const res = await fetch(`${API_URL}/api/dashboard/stats`, {
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
      <main className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 fixed inset-0 z-50">
        <div className="w-full max-w-[320px] flex flex-col items-center animate-fadeSlideUp">
          
          <div className="mb-10 w-[80px] h-[80px] rounded-full bg-[var(--accent-glow)] border border-[var(--border-accent)] flex items-center justify-center relative overflow-hidden" style={{ animation: 'pulse-orb 1.5s infinite ease-in-out' }}>
            <div className="w-[20px] h-[20px] bg-[var(--accent)] rounded-full shadow-[0_0_20px_var(--accent)] relative z-10"></div>
          </div>
          
          <h2 className="text-[20px] font-bold text-primary mb-2 text-center h-7">{stages[loadingStage].main}</h2>
          <p className="text-[15px] font-medium text-secondary mb-10 text-center h-5">{stages[loadingStage].sub}</p>

          <div className="flex gap-3 mb-10">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`rounded-full transition-all duration-300 ${i <= loadingStage ? 'w-2 h-2 bg-[var(--accent)] scale-125' : 'w-1.5 h-1.5 bg-[var(--border-md)]'}`} />
            ))}
          </div>

          <div className="text-[var(--text-tertiary)] text-[13px] font-mono font-bold tracking-widest uppercase">
            {elapsed} SECONDS ELAPSED
          </div>

        </div>
      </main>
    )
  }

  if (error || !coaching || !session) {
    return (
      <main className="min-h-screen bg-primary flex flex-col items-center justify-center p-6">
        <div className="card w-full max-w-sm text-center border-[var(--border)] shadow-lg">
          <div className="text-4xl mb-4 text-secondary">?</div>
          <h2 className="text-xl font-bold text-primary mb-2">Analysis Issue</h2>
          <p className="text-sm font-medium text-secondary mb-8">{error || 'Session not found'}</p>
          <button onClick={() => navigate(ROUTES.HOME)} className="w-full py-4 bg-[var(--accent)] text-white dark:text-black font-bold rounded-[var(--radius-md)] hover:scale-[1.02] active:scale-95 transition-all">Go home</button>
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
    <main className="min-h-screen bg-primary flex flex-col items-center justify-start pt-6 pb-28 px-6 overflow-x-hidden">
      
      {/* Gamification Confetti (CSS driven) */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center transition-opacity duration-1000 ${showCelebration ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-[800px] h-[800px] bg-[var(--accent)]/5 rounded-full blur-[100px] animate-pulse-orb"></div>
      </div>

      <div className="w-full max-w-[960px] flex flex-col lg:flex-row gap-8 items-start relative z-10">
        
        {/* ── LEFT COLUMN (Scores & Metrics) ── */}
        <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-[24px] font-[700] text-primary tracking-tight">Your Results</h1>
            <button onClick={() => navigate(ROUTES.DASHBOARD)} className="text-[var(--accent)] font-bold text-[14px] flex items-center gap-1 hover:underline">
              Dashboard <ChevronRight size={16} />
            </button>
          </div>

          {/* Hero Score */}
          <div className="w-full rounded-[var(--radius-xl)] bg-[var(--bg-card)] border border-[var(--border)] p-10 text-center flex flex-col items-center justify-center animate-cardEntrance shadow-md relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${heroColor.glow} 0%, transparent 70%)` }}></div>
            
            <div className="text-[12px] tracking-[0.15em] uppercase text-secondary font-bold mb-4 relative z-10">
              Overall Score
            </div>
            
            <div className="relative z-10 mb-2">
               <ScoreRing score={avgScore} size={140} />
            </div>
            
            <div className="mt-6 flex items-center gap-2 bg-[var(--bg-hover)] px-4 py-2 rounded-full border border-[var(--border)]">
              <Sparkles size={16} className="text-[var(--accent)]" />
              <span className="text-primary font-bold text-[14px]">{hookMessage.replace('🔥 ', '')}</span>
            </div>
          </div>

          {/* Detailed Scores Ring Grid */}
          <div className="card border-[var(--border)] bg-[var(--bg-card)] p-6 opacity-0 animate-cardEntrance shadow-sm" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <div className="flex items-center justify-between mb-6">
               <p className="text-tertiary text-[12px] uppercase tracking-[0.15em] font-bold">Metrics Breakdown</p>
            </div>
            
            <div className="grid grid-cols-3 gap-y-8 gap-x-2">
              {scoreKeys.map(key => {
                const sc = scores[key] || 0;
                let diffIcon = '—';
                let diffColor = 'var(--text-tertiary)';
                if (previousScores) {
                    const diff = sc - (previousScores[key] || 0);
                    if (diff > 0) { diffIcon = '↑'; diffColor = 'var(--accent)'; }
                    else if (diff < 0) { diffIcon = '↓'; diffColor = 'var(--red)'; }
                }
                return (
                  <div key={key} className="flex flex-col items-center">
                    <div className="relative">
                      <ScoreRing score={sc} label="" size={80} />
                    </div>
                    <div className="text-[12px] text-secondary font-bold mt-3 mb-1 text-center leading-tight h-8 flex items-center justify-center">{SCORE_LABELS[key] || key}</div>
                    <div className="text-[13px] font-bold font-mono bg-[var(--bg-hover)] px-2 py-0.5 rounded border border-[var(--border)]" style={{ color: diffColor }}>
                      {diffIcon} {previousScores ? Math.abs(sc - (previousScores[key] || 0)) : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (Coaching Feedback) ── */}
        <div className="flex-1 flex flex-col gap-6 w-full lg:pt-12">
          
          {/* Top Focus */}
          <div className="bg-[var(--bg-card)] border-l-[4px] border-l-[var(--red)] rounded-[var(--radius-lg)] p-6 shadow-sm opacity-0 animate-cardEntrance hover:border-[var(--border-md)] transition-colors border-y border-r" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
            <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 rounded-lg bg-red-500/10 text-[var(--red)] flex items-center justify-center">
                  <TrendingUp size={18} strokeWidth={2.5} />
               </div>
               <span className="text-[var(--red)] font-bold uppercase tracking-[0.1em] text-[12px]">Highest Priority Fix</span>
            </div>
            <p className="text-primary font-medium text-[16px] leading-[1.6]">{(coaching.priority_fix as string)}</p>
          </div>

          {/* Positives */}
          <div className="bg-[var(--bg-card)] border-l-[4px] border-l-[var(--accent)] rounded-[var(--radius-lg)] p-6 shadow-sm opacity-0 animate-cardEntrance hover:border-[var(--border-md)] transition-colors border-y border-r" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center">
                  <Sparkles size={18} strokeWidth={2.5} />
               </div>
               <span className="text-[var(--accent)] font-bold uppercase tracking-[0.1em] text-[12px]">What Went Well</span>
            </div>
            <p className="text-primary font-medium text-[16px] leading-[1.6]">{(coaching.what_went_well as string)}</p>
          </div>

          {/* Content Analysis */}
          <div className="bg-[var(--bg-card)] border-l-[4px] border-l-[var(--blue)] rounded-[var(--radius-lg)] p-6 shadow-sm opacity-0 animate-cardEntrance hover:border-[var(--border-md)] transition-colors border-y border-r" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
            <div className="flex items-center gap-2 mb-3">
               <span className="text-[var(--blue)] font-bold uppercase tracking-[0.1em] text-[12px]">Content & Ideas</span>
            </div>
            <p className="text-primary font-medium text-[15px] leading-[1.6]">
              {(coaching.content_feedback as string)}
            </p>
          </div>

          {/* Interactive Drill */}
          <div className="opacity-0 animate-cardEntrance mt-2" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
             <InteractiveDrillCard drill={(coaching.daily_drill as string) || "Focus on pausing during important points"} />
          </div>

        </div>

      </div>
    </main>
  )
}

function InteractiveDrillCard({ drill }: { drill: string }) {
  const [done, setDone] = useState(false);
  
  return (
    <div className={`card-interactive p-6 transition-all duration-500 overflow-hidden relative ${done ? 'bg-[var(--accent-dim)] border-[var(--border-accent)]' : 'bg-[var(--bg-card)] border-[var(--border)]'}`}>
       
       {done && (
         <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[var(--accent)]/20 rounded-full blur-[30px] animate-scale-pop pointer-events-none"></div>
       )}

       <div className="flex items-center gap-3 mb-4 relative z-10">
          <span className={`${done ? 'text-[var(--accent)]' : 'text-tertiary'} font-bold uppercase tracking-[0.1em] text-[12px] transition-colors`}>
            Daily Action Item
          </span>
       </div>
       
       <p className="text-primary font-medium text-[16px] leading-[1.6] mb-6 relative z-10">{drill}</p>
       
       <button 
         onClick={() => setDone(true)}
         disabled={done}
         className={`relative z-10 w-full md:w-auto px-8 py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 active:scale-95 ${
           done 
             ? 'bg-[var(--accent)] text-white dark:text-black shadow-[0_0_20px_var(--accent-glow)]' 
             : 'bg-[var(--bg-hover)] text-primary hover:bg-[var(--bg-card-active)] border border-[var(--border)] hover:border-[var(--border-md)]'
         }`}
       >
         {done ? (
           <>
             <CheckCircle2 size={18} strokeWidth={2.5} />
             Completed
           </>
         ) : (
           'Mark as practiced'
         )}
       </button>
    </div>
  )
}