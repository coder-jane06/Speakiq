import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './context/AuthContext'

// Pages
import HomePage     from './pages/Home.page'
import SessionPage  from './pages/Session.page'
import ResultsPage  from './pages/Results.page'
import NotFoundPage from './pages/NotFound.page'
import LoginPage    from './pages/Login.page'
import DashboardPage from './pages/Dashboard.page'
import ProfilePage  from './pages/Profile.page'
import SettingsPage from './pages/Settings.page'

/** Redirects unauthenticated users to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center text-secondary font-mono text-[14px]">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      {/* App Layout Wraps All Routes */}
      <AppLayout>
      <Routes>
        {/* ── Root ── */}
        <Route path="/" element={<HomePage />} />
        
        {/* ── Dashboard ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* ── Auth ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Protected core routes ── */}
        <Route
          path={ROUTES.SESSION}
          element={
            <ProtectedRoute>
              <SessionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RESULTS}
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/latest/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        {/* ── Settings & Profile ── */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*"    element={<Navigate to="/404" replace />} />
      </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
