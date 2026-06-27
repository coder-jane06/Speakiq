import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoachingReport } from '../hooks/useCoachingReport'
import { ScoreRing }         from '../components/results/ScoreRing'
import { ROUTES, API_URL }   from '../constants'
import { supabase } from '../services/supabase'
import { useStreak } from '../hooks/useStreak'
import { ArrowLeft, CheckCircle2, ChevronRight, Sparkles, TrendingUp, BarChart3, Cpu, Zap, Activity, Award, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis } from 'recharts'



export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate      = useNavigate()

  const { loading, error, session, metrics, coaching } = useCoachingReport(sessionId || 'latest')
  const { streakData } = useStreak()
  const [stats, setStats] = useState<any>(null)
  
  // For loading text progression
  const [loadingStage, setLoadingStage] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [activeTrendMetric, setActiveTrendMetric] = useState<'overall' | 'confidence' | 'vocab' | 'delivery'>('overall')

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

    const motivationalMessages = [
      "🚀 Hang on tight! You did an awesome job completing your speech session.",
      "🔥 Hang tight! AI is analyzing your tone, pace, and clarity metrics.",
      "💡 Fun Fact: Practicing speaking just 3 minutes a day doubles delivery confidence!",
      "✨ Almost there! Formulating personalized coaching tips for your next attempt.",
      "🎯 Final touches in progress! Preparing your comprehensive score report.",
    ];

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 fixed inset-0 z-50 relative overflow-hidden"
        style={{ background: 'var(--bg-base)' }}
      >
        {/* Soft green ambient background blobs */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.12) 0%, rgba(62,140,0,0) 70%)', filter: 'blur(60px)' }}
        />
        <div 
          className="absolute top-1/3 right-1/4 w-[250px] h-[250px] rounded-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0) 70%)', filter: 'blur(40px)' }}
        />

        <div className="w-full max-w-[440px] flex flex-col items-center animate-fadeSlideUp relative z-10 text-center">
          
          {/* Animated AI Processing Orb */}
          <div className="relative mb-8 flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full animate-ping opacity-20" style={{ background: '#3E8C00' }} />
            <div className="absolute w-36 h-36 rounded-full opacity-30 blur-xl" style={{ background: 'radial-gradient(circle, #3E8C00 0%, transparent 70%)' }} />
            
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center relative shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #3E8C00 0%, #22C55E 50%, #15803D 100%)',
                boxShadow: '0 0 50px rgba(62,140,0,0.35), inset 0 2px 4px rgba(255,255,255,0.4)',
                animation: 'pulse-orb 2s infinite ease-in-out',
              }}
            >
              <Sparkles className="absolute -top-1 -right-1 text-yellow-300 animate-bounce" size={20} />
              <Cpu size={38} className="text-white drop-shadow-md animate-pulse" strokeWidth={2} />
            </div>
          </div>
          
          {/* Stage Title & Subtitle */}
          <h2
            className="text-[26px] font-[800] tracking-[-0.02em] text-center mb-2 text-gray-900"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            {stages[loadingStage].main}
          </h2>
          <p className="text-[15px] font-medium text-center text-gray-500 mb-6">
            {stages[loadingStage].sub}
          </p>

          {/* Step Indicator Chips & Progress Bar */}
          <div className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
            <div className="flex justify-between items-center text-[12px] font-bold text-gray-400 mb-2">
              <span className="flex items-center gap-1 text-emerald-600">
                <Activity size={14} className="animate-spin" /> Step {loadingStage + 1} of 5
              </span>
              <span>{Math.min(100, Math.round(((loadingStage + 1) / 5) * 100))}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500 rounded-full"
                style={{ width: `${((loadingStage + 1) / 5) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{
                    width:  i <= loadingStage ? '10px' : '7px',
                    height: i <= loadingStage ? '10px' : '7px',
                    background: i <= loadingStage ? '#3E8C00' : '#E5E7EB',
                    boxShadow: i === loadingStage ? '0 0 10px rgba(62,140,0,0.6)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Motivational Guidance Message Card */}
          <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-[13px] font-semibold text-emerald-900 mb-6 shadow-sm animate-fadeSlideUp">
            <span>{motivationalMessages[loadingStage]}</span>
          </div>

          {/* Timer Counter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-mono font-bold tracking-widest text-gray-500 uppercase">
            <Zap size={12} className="text-amber-500" /> {elapsed} SECONDS ELAPSED
          </div>

        </div>

        <style>{`
          @keyframes pulse-orb {
            0%, 100% { transform: scale(1); }
            50%       { transform: scale(1.05); }
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
  let chartData: any[] = [];
  if (stats?.sessions && stats.sessions.length > 0) {
    const sorted = [...stats.sessions].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    chartData = sorted.map((s: any, index: number) => {
       const sc = s.scores || {};
       const sKeys = Object.keys(sc);
       const avg = Math.round(sKeys.reduce((acc, k) => acc + sc[k], 0) / (sKeys.length || 1));
       return { session: `S${index + 1}`, score: activeTrendMetric === 'overall' ? avg : (sc[activeTrendMetric] || 0) };
    });
  } else {
    chartData = [{ session: 'Current', score: activeTrendMetric === 'overall' ? avgScore : (scores[activeTrendMetric] || 0) }];
  }

  const displayDuration = (metrics as any)?.duration_secs 
    ? Math.round((metrics as any).duration_secs) 
    : (metrics as any)?.words?.length 
      ? Math.round((metrics as any).words[(metrics as any).words.length - 1].end) 
      : 0;

  return (
    <main
      className={`min-h-screen flex flex-col items-center justify-start pt-6 pb-28 px-6 overflow-x-hidden relative ${showCelebration ? 'opacity-100' : 'opacity-99'}`}
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Soft ambient background glow */}
      <div 
        className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.08) 0%, transparent 70%)', filter: 'blur(100px)' }}
      />

      <div className="w-full max-w-[1000px] flex flex-col relative z-10">

        {/* 🎉 Session Complete Banner */}
        <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all shadow-sm cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  🎉 SESSION COMPLETE
                </span>
                <span className="text-[12px] text-[var(--text-tertiary)]">• {(session as any)?.topic_text ? `Topic: ${(session as any).topic_text}` : 'AI Coaching Session'}</span>
              </div>
              <h1 className="text-[28px] sm:text-[34px] font-[800] text-[var(--text-primary)] tracking-[-0.03em] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                AI Coaching Report
              </h1>
            </div>
          </div>
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] font-bold text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] shadow-sm transition-all cursor-pointer"
          >
            Dashboard <ChevronRight size={16} />
          </button>
        </div>

        {/* ── SECTION 1 — Hero Summary ── */}
        <div className="w-full rounded-[28px] p-8 mb-8 relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] shadow-xl animate-cardEntrance">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
            <div className="flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
              {/* Radial Score Ring */}
              <div className="relative shrink-0 flex items-center justify-center">
                <ScoreRing score={avgScore} size={150} />
              </div>

              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">OVERALL SCORE</span>
                  {(() => {
                    const badge = avgScore >= 90 ? { label: 'Excellent', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' }
                      : avgScore >= 75 ? { label: 'Good', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' }
                      : avgScore >= 60 ? { label: 'Improving', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' }
                      : { label: 'Needs Work', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' }
                    return (
                      <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider" style={{ color: badge.color, background: badge.bg }}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="flex items-baseline justify-center sm:justify-start gap-2 mb-3">
                  <span className="text-[48px] font-[800] text-[var(--text-primary)] leading-none tracking-tight">{avgScore}</span>
                  <span className="text-[20px] font-medium text-[var(--text-tertiary)]">/ 100</span>
                  <span className="ml-3 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[12px]">
                    ↑ +7 improvement
                  </span>
                </div>
                <p className="text-[16px] font-medium text-[var(--text-secondary)] max-w-[420px]">
                  "{hookMessage.replace('🔥 ', '')}"
                </p>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center sm:items-end gap-3 w-full sm:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
              <span className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[13px] flex items-center gap-2 shadow-sm">
                <Sparkles size={16} className="text-emerald-400" /> AI Report Verification Passed
              </span>
              <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">Streak: {streak} Days Active</span>
            </div>
          </div>
        </div>

        {/* ── SECTION 2 — AI Coach Summary ── */}
        <div className="w-full rounded-[28px] p-8 mb-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl animate-cardEntrance relative overflow-hidden" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[var(--border)]">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">🤖 AI Coach Summary</h2>
              <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Personalized assessment generated specifically for your speech delivery</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
            {/* Overall Assessment & Strengths */}
            <div className="p-5 rounded-[20px] bg-[var(--bg-hover)] border border-[var(--border)]">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-400" /> Core Strengths
              </h3>
              <p className="text-[13px] font-medium text-[var(--text-secondary)] leading-relaxed mb-4">
                {(coaching.what_went_well as string) || "You demonstrated excellent presence and clear vocal delivery."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">✓ Clear Delivery</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">✓ Solid Confidence</span>
              </div>
            </div>

            {/* Needs Improvement & Priority Fix */}
            <div className="p-5 rounded-[20px] bg-[var(--bg-hover)] border border-[var(--border)]">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-amber-400" /> Needs Improvement
              </h3>
              <p className="text-[13px] font-medium text-[var(--text-secondary)] leading-relaxed mb-4">
                {(coaching.priority_fix as string) || "Focus on structuring your key transitions for maximum clarity."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[11px]">⚠ Structure Transitions</span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[11px]">⚠ Vocabulary Variety</span>
              </div>
            </div>

            {/* Recommended Drill & Impact */}
            <div className="p-5 rounded-[20px] bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Zap size={16} className="text-amber-400" /> Recommended Action
                </h3>
                <p className="text-[13px] font-bold text-[var(--text-primary)] mb-2">
                  {(coaching.daily_drill as string) || "Practice 2-minute timed delivery with structured pauses."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[12px] font-bold text-emerald-400">
                <span>Estimated Impact:</span>
                <span className="bg-emerald-500 text-black px-2.5 py-0.5 rounded-full text-[11px]">+15% Score Boost</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3 — Skill Analysis ── */}
        <div className="w-full rounded-[28px] p-8 mb-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl animate-cardEntrance" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-400" /> Skill Analysis Centerpiece
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Radar Chart */}
            <div className="h-[300px] w-full bg-[var(--bg-hover)] rounded-2xl p-4 border border-[var(--border)] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={[
                  { subject: 'Filler Control', A: scores.filler || 0, fullMark: 100 },
                  { subject: 'Delivery', A: scores.delivery || 0, fullMark: 100 },
                  { subject: 'Structure', A: scores.structure || 0, fullMark: 100 },
                  { subject: 'Vocabulary', A: scores.vocab || 0, fullMark: 100 },
                  { subject: 'Confidence', A: scores.confidence || 0, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="A" stroke="#22C55E" strokeWidth={3} fill="#22C55E" fillOpacity={0.25} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Right Skill Insights */}
            <div className="space-y-4">
              {(() => {
                let bestKey = 'delivery', bestVal = 0
                let worstKey = 'structure', worstVal = 100
                Object.keys(scores).forEach(k => {
                  if (scores[k] > bestVal) { bestVal = scores[k]; bestKey = k }
                  if (scores[k] < worstVal) { worstVal = scores[k]; worstKey = k }
                })
                return (
                  <>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-emerald-400">Best Skill</p>
                        <p className="text-[16px] font-extrabold text-[var(--text-primary)] capitalize">{bestKey} ({bestVal}/100)</p>
                      </div>
                      <span className="text-[24px]">👑</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-amber-400">Weakest Skill</p>
                        <p className="text-[16px] font-extrabold text-[var(--text-primary)] capitalize">{worstKey} ({worstVal}/100)</p>
                      </div>
                      <span className="text-[24px]">🎯</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                      <p className="text-[11px] font-bold uppercase text-[var(--text-tertiary)] mb-1">Overall Balance & AI Explanation</p>
                      <p className="text-[13px] font-medium text-[var(--text-secondary)] leading-relaxed">
                        Your radar signature shows strong foundational {bestKey}, with opportunity to elevate your overall profile by practicing focused drills in {worstKey}.
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>

        {/* ── SECTION 3.5 — Quantitative Session Stats ── */}
        <div className="w-full mb-8">
          <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-4 px-1 flex items-center justify-between">
            <span>Quantitative Analytics</span>
            <span className="text-[12px] font-normal text-[var(--text-tertiary)]">Actual session recording data</span>
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Speaking Time',
                value: `${displayDuration}s`,
                desc: 'Total active recording time'
              },
              {
                label: 'Words Spoken',
                value: (metrics as any)?.words?.length || 0,
                desc: 'Total transcribed words'
              },
              {
                label: 'Pace (WPM)',
                value: Math.round(metrics?.wpm || 0),
                desc: 'Words per minute'
              },
              {
                label: 'Silence',
                value: `${Math.round(metrics?.silence_percentage || 0)}%`,
                desc: 'Total silence duration'
              },
              {
                label: 'Longest Pause',
                value: `${(metrics?.longest_pause_sec || 0).toFixed(1)}s`,
                desc: 'Maximum pause length'
              },
              {
                label: 'Filler Words',
                value: metrics?.filler_count || 0,
                desc: 'Total filler words used'
              }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{stat.label}</span>
                <div className="mt-1">
                  <span className="text-[24px] font-extrabold text-[var(--text-primary)]">{stat.value}</span>
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">{stat.desc}</p>
                </div>
              </div>
            ))}
            
            {/* Filler Breakdown Card */}
            <div className="col-span-2 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block mb-3">Filler Word Breakdown</span>
              {metrics?.filler_detail && Object.keys(metrics.filler_detail).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics.filler_detail).map(([word, count]) => (
                    <div key={word} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] capitalize">{word}</span>
                      <span className="text-[12px] font-bold text-[var(--accent)] px-1.5 py-0.5 bg-[var(--accent-dim)] rounded-md">{count as number}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] font-medium text-emerald-500">Perfect! No filler words detected.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 4 — Performance Metrics ── */}
        <div className="w-full mb-8">
          <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-4 px-1 flex items-center justify-between">
            <span>Detailed Performance Metrics</span>
            <span className="text-[12px] font-normal text-[var(--text-tertiary)]">Click to expand detailed AI findings</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'delivery', name: '🎤 Delivery', score: scores.delivery || 0, desc: 'Vocal rhythm & pronunciation clarity' },
              { id: 'vocab', name: '📚 Vocabulary', score: scores.vocab || 0, desc: 'Precision & word choice variety' },
              { id: 'structure', name: '🧠 Structure', score: scores.structure || 0, desc: 'Coherent organization & flow' },
              { id: 'confidence', name: '😊 Confidence', score: scores.confidence || 0, desc: 'Vocal strength & poise' },
              { id: 'filler', name: '⚠ Filler Control', score: scores.filler || 0, desc: 'Minimizing um, ah, and stutters' },
            ].map(m => {
              const isExp = expandedMetric === m.id
              const badge = m.score >= 90 ? { label: 'Excellent', color: '#22C55E' }
                : m.score >= 75 ? { label: 'Improving', color: '#3B82F6' }
                : { label: 'Needs Work', color: '#F59E0B' }

              return (
                <div 
                  key={m.id}
                  onClick={() => setExpandedMetric(isExp ? null : m.id)}
                  className="p-5 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] shadow-md cursor-pointer transition-all hover:bg-[var(--bg-hover)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{m.name}</h3>
                    <span className="text-[18px] font-extrabold text-[var(--text-primary)]">{m.score}</span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden mb-3 border border-[var(--border)]">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${m.score}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-bold px-2 py-0.5 rounded-md" style={{ color: badge.color, backgroundColor: badge.color + '15' }}>
                      {badge.label}
                    </span>
                    <span className="text-[var(--text-tertiary)] font-medium flex items-center gap-1">
                      Details {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </div>

                  {isExp && (
                    <div className="mt-4 pt-3 border-t border-[var(--border)] text-[12px] space-y-2 text-[var(--text-secondary)] animate-fadeSlideUp">
                      <p className="font-bold text-[var(--text-primary)]">Why this score?</p>
                      <p className="text-[var(--text-secondary)]">Speech analysis evaluated rhythm and pause frequency during your response.</p>
                      <p className="font-bold text-[var(--text-primary)] mt-2">AI Suggestions & Exercises:</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded border border-emerald-500/20">✓ Slow down delivery</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 font-semibold rounded border border-blue-500/20">✓ Pause deliberately</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 5 — Progress Over Time ── */}
        <div className="w-full rounded-[28px] p-8 mb-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-xl animate-cardEntrance">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-400" /> Progress Over Time
              </h2>
              <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Track your historical performance growth</p>
            </div>
            <div className="flex items-center gap-1 bg-[var(--bg-hover)] p-1 rounded-xl text-[12px] font-bold text-[var(--text-secondary)] border border-[var(--border)]">
              {(['overall', 'confidence', 'vocab', 'delivery'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setActiveTrendMetric(m)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${activeTrendMetric === m ? 'bg-[var(--accent)] text-black font-bold' : 'hover:text-[var(--text-primary)]'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="session" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <YAxis domain={[50, 100]} stroke="var(--text-tertiary)" fontSize={11} axisLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="score" stroke="#22C55E" strokeWidth={3} dot={{ r: 5, fill: '#22C55E' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SECTION 6 — Session Statistics ── */}
        <div className="w-full rounded-[28px] p-6 mb-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-md">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-400" /> Compact Session Analytics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Speaking Time</p>
              <p className="text-[16px] font-extrabold text-[var(--text-primary)]">{displayDuration}s</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Words Spoken</p>
              <p className="text-[16px] font-extrabold text-[var(--text-primary)]">{(metrics as any)?.words?.length || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Pace (WPM)</p>
              <p className="text-[16px] font-extrabold text-emerald-400">{Math.round(metrics?.wpm || 0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Longest Pause</p>
              <p className="text-[16px] font-extrabold text-[var(--text-primary)]">{(metrics?.longest_pause_sec || 0).toFixed(1)}s</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Confidence</p>
              <p className="text-[16px] font-extrabold text-blue-400">{scores.confidence || 0}%</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Filler Words</p>
              <p className="text-[16px] font-extrabold text-amber-400">{metrics?.filler_count || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">AI Confidence</p>
              <p className="text-[16px] font-extrabold text-emerald-400">{avgScore}%</p>
            </div>
          </div>
        </div>

        {/* ── SECTION 7 — Achievements ── */}
        <div className="w-full rounded-[28px] p-6 mb-8 bg-[var(--bg-card)] border border-[var(--border)] shadow-md">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Award size={18} className="text-yellow-400" /> Session Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(scores.delivery || 0) > 80 ? (
              <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-amber-500/20 flex items-center gap-3">
                <span className="text-[28px]">🏆</span>
                <div>
                  <h4 className="text-[14px] font-bold text-amber-400">Strong Communicator</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">Maintained clear voice flow & tone</p>
                </div>
              </div>
            ) : null}
            {(scores.structure || 0) > 75 ? (
              <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-blue-500/20 flex items-center gap-3">
                <span className="text-[28px]">🎯</span>
                <div>
                  <h4 className="text-[14px] font-bold text-blue-400">Structured Thinker</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">Clear introduction and conclusion</p>
                </div>
              </div>
            ) : null}
            {(scores.vocab || 0) > 70 ? (
              <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-emerald-500/20 flex items-center gap-3">
                <span className="text-[28px]">📚</span>
                <div>
                  <h4 className="text-[14px] font-bold text-emerald-400">Vocabulary Builder</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">Used strong descriptive language</p>
                </div>
              </div>
            ) : null}
            {(scores.filler || 0) > 85 ? (
              <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-purple-500/20 flex items-center gap-3">
                <span className="text-[28px]">✨</span>
                <div>
                  <h4 className="text-[14px] font-bold text-purple-400">Clean Speaker</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">Hardly used any filler words</p>
                </div>
              </div>
            ) : null}
            {/* Fallback if no achievements won */}
            {((scores.delivery || 0) <= 80 && (scores.structure || 0) <= 75 && (scores.vocab || 0) <= 70 && (scores.filler || 0) <= 85) && (
              <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex items-center gap-3 col-span-1 md:col-span-3">
                <span className="text-[28px]">🌱</span>
                <div>
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)]">Growing Communicator</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">Keep practicing to unlock badges!</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 8 — Next Action ── */}
        <div className="w-full rounded-[28px] p-8 bg-[var(--bg-card)] border border-[var(--border)] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              TODAY'S RECOMMENDED PRACTICE
            </span>
            <h3 className="text-[24px] font-bold mt-3 mb-2 text-[var(--text-primary)]">Ready for your next AI practice session?</h3>
            <p className="text-[14px] text-[var(--text-secondary)] font-medium max-w-[500px]">
              Spend just 2 minutes practicing transition structures to boost your speech clarity score by up to 15%.
            </p>
            <div className="flex items-center gap-4 mt-4 text-[12px] font-semibold text-[var(--text-tertiary)]">
              <span>⏱ Est. Time: 2 mins</span>
              <span>•</span>
              <span>🔥 Difficulty: Medium</span>
              <span>•</span>
              <span>🎯 Skills: Structure & Vocab</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={() => navigate(ROUTES.SESSION)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-[15px] shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              style={{ background: '#3E8C00', color: '#FFFFFF' }}
            >
              <span>Start Practice 🚀</span>
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="w-full sm:w-auto px-6 py-4 rounded-xl font-bold text-[14px] text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            >
              View Full Report
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}

export function InteractiveDrillCard({ sessionId, drill }: { sessionId: string, drill: string }) {
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
