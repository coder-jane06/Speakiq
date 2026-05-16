import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C8F97D]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 text-center max-w-xl">
        {/* Logo mark */}
        <div className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-[#C8F97D] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C8 2 3 5 3 9C3 11.76 5.24 14 8 14C10.76 14 13 11.76 13 9C13 5 8 2 8 2Z" fill="#0A0A0A"/>
            </svg>
          </div>
          <span className="text-white font-semibold tracking-tight text-lg">SpeakIQ</span>
        </div>

        <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight mb-4">
          Speak better.<br />
          <span className="text-[#C8F97D]">Every single day.</span>
        </h1>

        <p className="text-[#888] text-lg leading-relaxed mb-10">
          One topic. One minute. Real AI feedback on how you speak — 
          filler words, pacing, delivery, structure.
        </p>

        <button
          onClick={() => navigate(ROUTES.SESSION)}
          className="w-full bg-[#C8F97D] text-[#0A0A0A] font-semibold text-base py-4 px-8 rounded-2xl hover:bg-[#d4ff8a] transition-colors duration-150"
        >
          Start today's session
        </button>

        <p className="text-[#555] text-sm mt-4">
          3 minutes total · No account needed to try
        </p>
      </div>
    </main>
  )
}
