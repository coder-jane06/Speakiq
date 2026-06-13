import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionFlow }  from '../hooks/useSessionFlow'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { AudioWaveform, RecordButton } from '../components/AudioRecorder'
import { ROUTES } from '../constants'
import { TopicCard } from '../components/TopicCard'
import type { Topic } from '../types'
import { ArrowLeft, Clock } from 'lucide-react'

export default function SessionPage() {
  const navigate = useNavigate()
  const flow     = useSessionFlow()
  const recorder = useAudioRecorder()
  
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

  useEffect(() => {
    if (flow.state === 'recording' && !recorder.isRecording) {
      recorder.startRecording()
      flow.startRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.state])

  useEffect(() => {
    if (flow.recSecsLeft === 0 && recorder.isRecording) {
      recorder.stopRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.recSecsLeft])

  useEffect(() => {
    if (recorder.audioBlob && flow.state === 'recording') {
      flow.finishRecording(recorder.audioBlob)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob])

  useEffect(() => {
    if (flow.state === 'analyzing' && flow.sessionId) {
      navigate(`/session/${flow.sessionId}/results`)
    }
  }, [flow.state, flow.sessionId])

  // Back: go home (dashboard empty for new users)
  const handleBack = () => navigate(ROUTES.HOME)

  const circumference = 2 * Math.PI * 76
  const strokeDashoffset = circumference - (flow.prepSecsLeft / 30) * circumference
  // Recording ring: use recProgress so 90s/120s users see correct progress
  const recCircumference = 2 * Math.PI * 22
  const recDashoffset = recCircumference - flow.recProgress * recCircumference

  const isIdle      = flow.state === 'idle'
  const isPrep      = flow.state === 'prep'
  const isRecording = flow.state === 'recording'
  const isUploading = flow.state === 'uploading' || flow.state === 'analyzing'
  const isError     = flow.state === 'error'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Ambient recording glow — only when recording */}
      {isRecording && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
          style={{
            background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(163,230,53,0.05) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Subtle static noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      <div className="w-full max-w-[680px] flex-1 flex flex-col pt-4 relative z-10">

        {/* Back button */}
        {(isIdle || isPrep || isError) && (
          <button
            onClick={handleBack}
            className="self-start flex items-center gap-2 mb-6 px-3 py-2 -ml-2 rounded-xl transition-all duration-200"
            style={{
              color: 'var(--text-tertiary)',
              background: 'transparent',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="text-[13px] font-semibold tracking-wide">Cancel</span>
          </button>
        )}

        {/* ── IDLE: Topic Selection ── */}
        {isIdle && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp w-full">
            <h1
              className="text-[38px] lg:text-[44px] font-[800] mb-3 tracking-[-0.025em] text-center"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
              }}
            >
              Let's get started
            </h1>
            <p
              className="text-[16px] font-medium mb-10 text-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              Pick your topic and start speaking
            </p>
            
            <div className="w-full max-w-[680px] mb-8">
              <TopicCard onReady={setSelectedTopic} />
            </div>

            {/* Mic permission error */}
            {recorder.error && (
              <div
                className="w-full max-w-[680px] mb-4 px-4 py-3 rounded-xl text-[13px] font-medium"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--red)',
                }}
              >
                ⚠️ Microphone error: {recorder.error}
              </div>
            )}

            <button
              disabled={!selectedTopic}
              onClick={() => selectedTopic && flow.startPrep(selectedTopic)}
              className="w-full max-w-[680px] px-10 py-4 text-[16px] font-bold rounded-full transition-all duration-200 active:scale-[0.98]"
              style={selectedTopic ? {
                background: 'var(--accent)',
                color: '#09090F',
                boxShadow: '0 0 32px var(--accent-glow)',
                transform: 'translateY(0)',
              } : {
                background: 'var(--bg-card)',
                color: 'var(--text-tertiary)',
                cursor: 'not-allowed',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={e => {
                if (selectedTopic) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 48px var(--accent-glow)'
                }
              }}
              onMouseLeave={e => {
                if (selectedTopic) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px var(--accent-glow)'
                }
              }}
            >
              Start Session
            </button>
            <p
              className="mt-4 text-[13px] font-medium flex items-center justify-center gap-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <Clock size={13} /> You'll have 30 seconds to prepare
            </p>
          </div>
        )}

        {/* ── PREP: Countdown ── */}
        {isPrep && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp">
            {/* Topic reminder card */}
            <div
              className="w-full max-w-[680px] rounded-[24px] p-8 text-center mb-14"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <h2
                className="text-[11px] tracking-[0.14em] uppercase mb-4 font-bold"
                style={{ color: 'var(--accent)' }}
              >
                Your Topic
              </h2>
              <p
                className="text-[24px] leading-snug font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {flow.topic?.text}
              </p>
            </div>

            {/* Timer ring with ambient glow */}
            <div className="flex flex-col items-center">
              <div className="relative w-[220px] h-[220px] flex items-center justify-center mb-10">
                {/* Radial ambient glow behind ring — pulsing lime */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at center, var(--accent-glow) 0%, transparent 65%)',
                    animation: 'pulse-orb 2s ease-in-out infinite',
                    opacity: 0.55,
                  }}
                />
                <svg className="w-full h-full transform -rotate-90 relative z-10">
                  <circle cx="110" cy="110" r="76" stroke="var(--border-md)" strokeWidth="4" fill="none" />
                  <circle 
                    cx="110" cy="110" r="76" 
                    stroke="var(--accent)" strokeWidth="6" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                    style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center z-20">
                  <span
                    className="text-[72px] font-[800] tracking-[-0.05em] leading-none font-mono"
                    style={{ color: 'var(--text-primary)', fontFamily: "'Bricolage Grotesque', monospace" }}
                  >
                    {flow.prepSecsLeft}
                  </span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest mt-1"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    SEC
                  </span>
                </div>
              </div>
              <p
                className="font-semibold text-[18px] mb-10 tracking-[-0.01em]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Gather your thoughts
              </p>
            </div>
            
            <button 
              onClick={() => flow.skipPrep()}
              className="px-8 py-3 rounded-full text-[14px] font-semibold transition-all duration-200"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-md)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
              }}
            >
              Skip countdown
            </button>
          </div>
        )}

        {/* ── RECORDING ── */}
        {isRecording && (
          <div className="flex-1 flex flex-col items-center justify-between pb-10 pt-4 animate-fadeSlideUp relative z-10">
            
            {/* Topic reminder */}
            <div
              className="w-full max-w-[520px] text-center rounded-[20px] p-5 transition-opacity duration-300 opacity-60 hover:opacity-100"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <h2
                className="text-[10px] tracking-[0.14em] uppercase mb-2 font-bold"
                style={{ color: 'var(--accent)' }}
              >
                Topic
              </h2>
              <p
                className="text-[16px] font-medium px-4"
                style={{ color: 'var(--text-primary)' }}
              >
                {flow.topic?.text}
              </p>
            </div>

            {/* Waveform — taller bars */}
            <div className="w-full max-w-[600px] flex-1 flex flex-col items-center justify-center">
              <div className="w-full" style={{ height: '80px' }}>
                <AudioWaveform analyserNode={recorder.analyserNode} isRecording={recorder.isRecording} />
              </div>
            </div>

            {/* Recording controls */}
            <div
              className="w-full max-w-[520px] flex items-center justify-between px-8 rounded-full py-4"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: '0 0 0 1px rgba(163,230,53,0.12), 0 8px 32px rgba(0,0,0,0.5)',
                animation: 'recording-pulse-border 2.5s ease-in-out infinite',
              }}
            >
              {/* Timer ring */}
              <div className="relative w-[50px] h-[50px] flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="25" cy="25" r="22" stroke="var(--border-md)" strokeWidth="3" fill="none" />
                  <circle 
                    cx="25" cy="25" r="22" 
                    stroke={flow.recSecsLeft < 10 ? 'var(--red)' : flow.recSecsLeft < 20 ? 'var(--amber)' : 'var(--accent)'} 
                    strokeWidth="3" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={recCircumference}
                    strokeDashoffset={recDashoffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span
                  className="absolute text-[14px] font-[700] font-mono tracking-tighter"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {flow.recSecsLeft}
                </span>
              </div>

              <RecordButton isRecording={true} onClick={() => recorder.stopRecording()} />
              
              <div className="w-[50px] flex justify-end">
                <div
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{
                    background: 'var(--red)',
                    boxShadow: '0 0 10px var(--red)',
                  }}
                />
              </div>
            </div>

          </div>
        )}

        {/* ── UPLOADING / ANALYZING ── */}
        {isUploading && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center gap-6">
            <div className="relative w-24 h-24">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '4px solid var(--border-md)',
                }}
              />
              <div
                className="absolute inset-0 rounded-full border-t-transparent animate-spin"
                style={{
                  border: '4px solid var(--accent)',
                  borderTopColor: 'transparent',
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at center, var(--accent-glow) 0%, transparent 70%)',
                  opacity: 0.4,
                  animation: 'pulse-orb 1.5s ease-in-out infinite',
                }}
              />
            </div>
            <div>
              <h2
                className="text-[26px] font-bold mb-3 tracking-[-0.02em]"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: 'var(--text-primary)',
                }}
              >
                Analyzing your speech
              </h2>
              <p
                className="text-[15px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                This usually takes about 10–15 seconds…
              </p>
              <p
                className="text-[13px] mt-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Your AI coach is reviewing every word
              </p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center">
            <div
              className="w-20 h-20 rounded-[22px] flex items-center justify-center text-4xl mb-6"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--red)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              ⚠️
            </div>
            <h2
              className="text-[28px] font-bold mb-4 tracking-[-0.02em]"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: 'var(--text-primary)',
              }}
            >
              Something went wrong
            </h2>
            <p
              className="mb-8 max-w-sm text-[15px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {flow.error || 'Failed to upload or analyze the audio.'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="px-8 py-3.5 rounded-[16px] font-bold text-[14px] transition-all duration-200"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'}
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleBack}
                className="px-8 py-3.5 rounded-[16px] font-bold text-[14px] transition-all duration-200"
                style={{
                  background: 'var(--accent)',
                  color: '#09090F',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Global keyframe for recording border pulse */}
      <style>{`
        @keyframes recording-pulse-border {
          0%, 100% { box-shadow: 0 0 0 1px rgba(163,230,53,0.12), 0 8px 32px rgba(0,0,0,0.5); }
          50%       { box-shadow: 0 0 0 2px rgba(163,230,53,0.28), 0 8px 40px rgba(0,0,0,0.6); }
        }
        @keyframes pulse-orb {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.06); }
        }
      `}</style>
    </main>
  )
}