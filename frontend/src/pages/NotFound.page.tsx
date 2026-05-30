import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <main className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-6 text-center">
      <span className="text-6xl font-mono text-[var(--border)] mb-6">404</span>
      <h1 className="text-primary text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">This page doesn't exist.</p>
      <button
        onClick={() => navigate(ROUTES.HOME)}
        className="bg-[var(--accent)] text-[var(--bg-base)] font-semibold py-3 px-6 rounded-xl hover:scale-105 transition-all"
      >
        Go home
      </button>
    </main>
  )
}
