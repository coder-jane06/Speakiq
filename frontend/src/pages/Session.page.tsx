// Phase 2 will build this page out fully.
// For now it confirms the route works and shows the session states.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SessionState } from '../types'
import { ROUTES } from '../constants'

const STATE_LABELS: Record<SessionState, string> = {
  idle:      'Ready to start',
  prep:      'Prep time — read your topic',
  recording: 'Speak now',
  uploading: 'Saving your recording...',
  analyzing: 'AI is analyzing your speech...',
  results:   'Your results are ready',
  error:     'Something went wrong',
}

export default function SessionPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<SessionState>('idle')

  // Temporary state stepper — replace with real session logic in Phase 2
  const nextState: Partial<Record<SessionState, SessionState>> = {
    idle:      'prep',
    prep:      'recording',
    recording: 'uploading',
    uploading: 'analyzing',
    analyzing: 'results',
  }

  function advance() {
    const next = nextState[state]
    if (next) setState(next)
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="text-[#555] hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
          <span className="text-[#555] text-sm font-mono">
            {state.toUpperCase()}
          </span>
        </div>

        {/* State card */}
        <div className="bg-[#111] border border-[#222] rounded-3xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center mx-auto mb-6">
            <StateIcon state={state} />
          </div>

          <h2 className="text-white text-2xl font-semibold mb-2">
            {STATE_LABELS[state]}
          </h2>

          <p className="text-[#555] text-sm mb-8">
            {state === 'idle' && 'Press start to receive your topic.'}
            {state === 'prep' && 'You have 30 seconds to gather your thoughts.'}
            {state === 'recording' && 'Speak clearly for 60 seconds.'}
            {state === 'uploading' && 'Please wait...'}
            {state === 'analyzing' && 'This takes about 10–15 seconds.'}
            {state === 'results' && 'See how you did today.'}
            {state === 'error' && 'Please try again.'}
          </p>

          {state !== 'results' && state !== 'error' && (
            <button
              onClick={advance}
              className="w-full bg-[#C8F97D] text-[#0A0A0A] font-semibold py-3.5 rounded-xl hover:bg-[#d4ff8a] transition-colors"
            >
              {state === 'idle' ? 'Start session' : 'Continue →'}
            </button>
          )}

          {state === 'error' && (
            <button
              onClick={() => setState('idle')}
              className="w-full border border-[#333] text-white font-semibold py-3.5 rounded-xl hover:border-[#555] transition-colors"
            >
              Try again
            </button>
          )}
        </div>

        {/* Phase note */}
        <p className="text-center text-[#333] text-xs mt-6">
          Full session UI built in Phase 2
        </p>
      </div>
    </main>
  )
}

function StateIcon({ state }: { state: SessionState }) {
  const icons: Record<SessionState, string> = {
    idle:      '○',
    prep:      '◎',
    recording: '●',
    uploading: '↑',
    analyzing: '⟳',
    results:   '✓',
    error:     '✕',
  }
  const colors: Record<SessionState, string> = {
    idle:      'text-[#444]',
    prep:      'text-[#C8F97D]',
    recording: 'text-red-400',
    uploading: 'text-blue-400',
    analyzing: 'text-yellow-400',
    results:   'text-[#C8F97D]',
    error:     'text-red-400',
  }
  return (
    <span className={`text-2xl font-mono ${colors[state]}`}>
      {icons[state]}
    </span>
  )
}
