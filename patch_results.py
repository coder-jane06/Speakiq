import re

with open("frontend/src/pages/Results.page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
imports = """
import { TranscriptViewer } from '../components/results/TranscriptViewer'
import { AudioPlayer, AudioPlayerRef } from '../components/results/AudioPlayer'
import { WorstMomentCard } from '../components/results/WorstMomentCard'
import { SentenceRewriteCard } from '../components/results/SentenceRewriteCard'
import { DeliveryDiagnosis } from '../components/results/DeliveryDiagnosis'
import { FillerBreakdown } from '../components/results/FillerBreakdown'
"""
content = content.replace("import { ScoreRing }", imports + "import { ScoreRing }")

# 2. Add state inside component
state_hook = """
  const [transcript, setTranscript] = useState<any[]>([])
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  const audioPlayerRef = useRef<AudioPlayerRef>(null)

  useEffect(() => {
    if (!sessionId || loading || !session) return;
    
    const fetchPhase2Data = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const token = authSession?.access_token;
        const headers = { 'Authorization': token ? `Bearer ${token}` : '' }
        
        const trRes = await fetch(`${API_URL}/sessions/${sessionId}/transcript`, { headers });
        if (trRes.ok) setTranscript(await trRes.json());
        
        const auRes = await fetch(`${API_URL}/sessions/${sessionId}/audio-url`, { headers });
        if (auRes.ok) {
          const auData = await auRes.json();
          setAudioUrl(auData.url);
        }
      } catch (err) { console.error("Phase 2 fetch error", err) }
    };
    fetchPhase2Data();
  }, [sessionId, loading, session]);
"""
if "const [transcript, setTranscript] = useState" not in content:
    content = content.replace(
        "const [activeTrendMetric, setActiveTrendMetric] = useState<'overall' | 'confidence' | 'vocab' | 'delivery'>('overall')",
        "const [activeTrendMetric, setActiveTrendMetric] = useState<'overall' | 'confidence' | 'vocab' | 'delivery'>('overall')\n" + state_hook
    )
    content = content.replace("import { useState, useEffect } from 'react'", "import { useState, useEffect, useRef } from 'react'")

# 3. Add Phase 2 UI Section between Section 1 and Section 2
phase2_ui = """
        {/* ── PHASE 2: RESULTS EXPERIENCE ── */}
        <div className="w-full mb-8 flex flex-col gap-6 animate-cardEntrance" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
          
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2">
               Your Speaking Analysis
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Audio & Transcript */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {audioUrl && (
                <AudioPlayer 
                  ref={audioPlayerRef} 
                  src={audioUrl} 
                  onTimeUpdate={setCurrentAudioTime} 
                />
              )}
              
              <div className="p-6 rounded-[22px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm h-[400px] overflow-y-auto custom-scrollbar">
                {transcript.length > 0 ? (
                  <TranscriptViewer 
                    words={transcript} 
                    currentTime={currentAudioTime} 
                    onWordClick={(time) => audioPlayerRef.current?.seekTo(time)} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">Loading transcript...</div>
                )}
              </div>
            </div>

            {/* Right Column: Deep Insights */}
            <div className="flex flex-col gap-6 h-full">
              {coaching?.worst_moment && (
                <WorstMomentCard 
                  quote={coaching.worst_moment.quote}
                  timestamp_s={coaching.worst_moment.timestamp_s}
                  what_went_wrong={coaching.worst_moment.what_went_wrong}
                  onJumpToTime={(time) => audioPlayerRef.current?.seekTo(time)}
                />
              )}
              {coaching?.rewritten_sentences && (
                <SentenceRewriteCard rewrites={coaching.rewritten_sentences} />
              )}
            </div>

          </div>

          {/* Delivery & Fillers Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DeliveryDiagnosis 
              wpm={metrics?.wpm || 0}
              pitchVariance={metrics?.pitch_variance || 0}
              silenceCount={(metrics?.silence_gaps || []).length}
            />
            <FillerBreakdown 
              fillers={metrics?.filler_words || []}
            />
          </div>

        </div>
"""

# Inject before Section 2
content = content.replace("{/* ── SECTION 2 — AI Coach Summary ── */}", phase2_ui + "\n        {/* ── SECTION 2 — AI Coach Summary ── */}")

with open("frontend/src/pages/Results.page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Injected Phase 2 into Results.page.tsx")
