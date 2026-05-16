import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <span className="text-6xl font-mono text-[#222] mb-6">404</span>
      <h1 className="text-white text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-[#555] text-sm mb-8">This page doesn't exist.</p>
      <button
        onClick={() => navigate(ROUTES.HOME)}
        className="bg-[#C8F97D] text-[#0A0A0A] font-semibold py-3 px-6 rounded-xl hover:bg-[#d4ff8a] transition-colors"
      >
        Go home
      </button>
    </main>
  )
}
