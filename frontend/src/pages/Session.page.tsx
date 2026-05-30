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
  }, [flow.state])

  useEffect(() => {
    if (flow.recSecsLeft === 0 && recorder.isRecording) {
      recorder.stopRecording()
    }
  }, [flow.recSecsLeft])

  useEffect(() => {
    if (recorder.audioBlob && flow.state === 'recording') {
      flow.finishRecording(recorder.audioBlob)
    }
  }, [recorder.audioBlob])

  useEffect(() => {
    if (flow.state === 'analyzing' && flow.sessionId) {
      navigate(`/session/${flow.sessionId}/results`)
    }
  }, [flow.state, flow.sessionId])

  const circumference = 2 * Math.PI * 76;
  const strokeDashoffset = circumference - (flow.prepSecsLeft / 30) * circumference;

  const isIdle = flow.state === 'idle';
  const isPrep = flow.state === 'prep';
  const isRecording = flow.state === 'recording';
  const isUploading = flow.state === 'uploading' || flow.state === 'analyzing';
  const isError = flow.state === 'error';

  return (
    <main className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-primary relative">
      <div className="w-full max-w-[680px] flex-1 flex flex-col pt-4">

        {/* Back button */}
        {(isIdle || isPrep || isError) && (
          <button 
            onClick={() => navigate(ROUTES.DASHBOARD)} 
            className="self-start flex items-center gap-2 text-tertiary hover:text-primary p-2 -ml-2 mb-6 transition-colors rounded-xl hover:bg-[var(--bg-hover)]"
          >
            <ArrowLeft size={20} strokeWidth={2} />
            <span className="text-[14px] font-medium">Cancel</span>
          </button>
        )}

        {/* ── IDLE: Topic Selection ── */}
        {isIdle && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp w-full">
            <h1 className="text-[36px] lg:text-[42px] font-[700] mb-3 tracking-[-0.02em] text-primary text-center">Let's get started</h1>
            <p className="text-secondary text-[16px] font-medium mb-10 text-center">Pick your topic and start speaking</p>
            
            <div className="w-full max-w-[560px] mb-8">
              <TopicCard onReady={setSelectedTopic} />
            </div>

            <button
              disabled={!selectedTopic}
              onClick={() => selectedTopic && flow.startPrep(selectedTopic)}
              className={`w-full max-w-[560px] py-4 rounded-[18px] text-[16px] font-bold shadow-lg transition-all transform active:scale-[0.98] ${
                selectedTopic 
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:scale-[1.02] hover:shadow-xl' 
                  : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] cursor-not-allowed border border-[var(--border)]'
              }`}
            >
              Start Session
            </button>
            <p className="mt-4 text-[13px] text-tertiary font-medium flex items-center justify-center gap-1.5">
               <Clock size={14} /> You'll have 30 seconds to prepare
            </p>
          </div>
        )}

        {/* ── PREP: Countdown ── */}
        {isPrep && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp">
            {/* Topic card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] p-8 w-full max-w-[560px] text-center shadow-sm mb-14">
               <h2 className="text-[13px] tracking-[0.1em] text-[var(--accent)] uppercase mb-4 font-bold">Your Topic</h2>
               <p className="text-[24px] leading-snug text-primary font-medium">{flow.topic?.text}</p>
            </div>

            {/* Timer ring */}
            <div className="flex flex-col items-center">
              <div className="relative w-[200px] h-[200px] flex items-center justify-center mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="100" cy="100" r="76" stroke="var(--border-md)" strokeWidth="4" fill="none" />
                  <circle 
                    cx="100" cy="100" r="76" 
                    stroke="var(--accent)" strokeWidth="6" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[64px] font-[700] tracking-[-0.04em] leading-none font-mono text-primary">
                    {flow.prepSecsLeft}
                  </span>
                  <span className="text-[12px] text-tertiary font-bold uppercase tracking-wider mt-1">SEC</span>
                </div>
              </div>
              <p className="text-secondary font-medium text-[18px] mb-8">Gather your thoughts</p>
            </div>
            
            <button 
              onClick={() => flow.skipPrep()}
              className="px-8 py-3 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[14px] text-secondary font-medium hover:text-primary hover:bg-[var(--bg-hover)] transition-all"
            >
              Skip countdown
            </button>
          </div>
        )}

        {/* ── RECORDING ── */}
        {isRecording && (
          <div className="flex-1 flex flex-col items-center justify-between pb-10 pt-4 animate-fadeSlideUp">
            
            {/* Topic reminder */}
            <div className="w-full max-w-[560px] text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-[20px] p-5 shadow-sm opacity-60 hover:opacity-100 transition-opacity">
               <h2 className="text-[11px] tracking-[0.1em] text-[var(--accent)] uppercase mb-2 font-bold">Topic</h2>
               <p className="text-[16px] font-medium px-4 text-primary">{flow.topic?.text}</p>
            </div>

            {/* Waveform */}
            <div className="w-full max-w-[600px] flex-1 flex flex-col items-center justify-center">
                <AudioWaveform analyserNode={recorder.analyserNode} isRecording={recorder.isRecording} />
            </div>

            {/* Recording controls */}
            <div className="w-full max-w-[480px] flex items-center justify-between px-8 bg-[var(--bg-card)] border border-[var(--border)] rounded-full py-4 shadow-lg">
              {/* Timer ring */}
              <div className="relative w-[50px] h-[50px] flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="25" cy="25" r="22" stroke="var(--border-md)" strokeWidth="3" fill="none" />
                  <circle 
                    cx="25" cy="25" r="22" 
                    stroke={flow.recSecsLeft < 10 ? 'var(--red)' : flow.recSecsLeft < 20 ? 'var(--amber)' : 'var(--accent)'} 
                    strokeWidth="3" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={(2 * Math.PI * 22) - (flow.recSecsLeft / 60) * (2 * Math.PI * 22)}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute text-[14px] font-[700] font-mono tracking-tighter text-primary">
                  {flow.recSecsLeft}
                </span>
              </div>

              <RecordButton isRecording={true} onClick={() => recorder.stopRecording()} />
              
              <div className="w-[50px] flex justify-end">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--red)] animate-pulse shadow-[0_0_8px_var(--red)]"></div>
              </div>
            </div>

          </div>
        )}

        {/* ── UPLOADING / ANALYZING ── */}
        {isUploading && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center">
            <div className="w-24 h-24 mb-8 relative">
               <div className="absolute inset-0 border-4 border-[var(--border-md)] rounded-full"></div>
               <div className="absolute inset-0 border-4 border-[var(--accent)] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-[26px] font-bold text-primary mb-3">Analyzing your speech</h2>
            <p className="text-secondary font-medium text-[16px]">This usually takes about 10-15 seconds...</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeSlideUp text-center">
            <div className="w-20 h-20 bg-red-500/15 text-[var(--red)] rounded-[22px] flex items-center justify-center text-4xl mb-6">
              ⚠️
            </div>
            <h2 className="text-[26px] font-bold text-primary mb-4">Something went wrong</h2>
            <p className="text-secondary mb-8 max-w-md text-[16px]">{flow.error || 'Failed to upload or analyze the audio.'}</p>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="bg-[var(--bg-card)] border border-[var(--border)] text-primary px-8 py-3.5 rounded-[16px] font-bold hover:bg-[var(--bg-hover)] transition-colors"
            >
              Go back
            </button>
          </div>
        )}

      </div>
    </main>
  )
}