import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants'
import { SystemStatus } from './components/SystemStatus'

// Pages — loaded eagerly for now, switch to lazy() in Phase 5
import HomePage    from './pages/Home.page'
import SessionPage from './pages/Session.page'
import NotFoundPage from './pages/NotFound.page'

export default function App() {
  return (
    <BrowserRouter>
      {/* Backend health indicator — visible on every page */}
      <SystemStatus />

      <Routes>
        {/* ── Core routes ─────────────────────────────── */}
        <Route path={ROUTES.HOME}    element={<HomePage />} />
        <Route path={ROUTES.SESSION} element={<SessionPage />} />

        {/* ── Placeholder routes (built in later phases) ─ */}
        <Route
          path={ROUTES.RESULTS}
          element={
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#555] font-mono text-sm">
              Results page — Phase 4
            </div>
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#555] font-mono text-sm">
              Dashboard — Phase 5
            </div>
          }
        />
        <Route
          path={ROUTES.ONBOARDING}
          element={
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#555] font-mono text-sm">
              Onboarding — Phase 5
            </div>
          }
        />

        {/* ── Catch-all ───────────────────────────────── */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*"    element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
