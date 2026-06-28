import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ROUTES, API_URL } from './constants'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'

// Pages
import HomePage     from './pages/Home.page'
import SessionPage  from './pages/Session.page'
import ResultsPage  from './pages/Results.page'
import NotFoundPage from './pages/NotFound.page'
import LoginPage    from './pages/Login.page'
import DashboardPage from './pages/Dashboard.page'
import ProfilePage  from './pages/Profile.page'
import SettingsPage from './pages/Settings.page'
import OnboardingPage from './pages/Onboarding.page'

/** Redirects unauthenticated users to /login */
function ProtectedRoute({ children, requireOnboarding = false }: { children: React.ReactNode, requireOnboarding?: boolean }) {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  // Only start with onboardingLoading=true if we actually need to check it
  // Don't block if we don't have a user yet — auth redirect will handle it
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // If no user, no need to check onboarding — <Navigate> below will redirect
    if (!user) {
      setOnboardingLoading(false)
      setOnboardingChecked(true)
      return;
    }

    // If we don't need to check onboarding, we're done
    if (!requireOnboarding) {
      setOnboardingChecked(true)
      return;
    }

    // Already checked, skip
    if (onboardingChecked) return;

    let isMounted = true;
    setOnboardingLoading(true)
    const checkOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(`${API_URL}/dashboard/profile-status`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        })
        if (res.ok) {
          const data = await res.json()
          if (!data.onboarding_complete && isMounted) {
            navigate(ROUTES.ONBOARDING, { replace: true })
            return
          }
        }
      } catch (err) {
        console.error("Error checking onboarding status:", err)
      } finally {
        if (isMounted) {
          setOnboardingLoading(false)
          setOnboardingChecked(true)
        }
      }
    }
    checkOnboarding()
    return () => { isMounted = false }
  }, [user, authLoading, navigate, requireOnboarding, onboardingChecked])

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-md)] border-t-[var(--accent)] animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      {/* App Layout Wraps All Routes */}
      <AppLayout>
      <Routes>
        {/* ── Root ── */}
        <Route path="/" element={<HomePage />} />
        
        {/* ── Dashboard ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireOnboarding={true}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* ── Auth ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Results ── */}
        <Route
          path="/session/:sessionId/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        {/* ── Onboarding ── */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* ── Protected core routes ── */}
        <Route
          path={ROUTES.SESSION}
          element={
            <ProtectedRoute requireOnboarding={true}>
              <SessionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RESULTS}
          element={
            <ProtectedRoute requireOnboarding={true}>
              <ResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/latest/results"
          element={
            <ProtectedRoute requireOnboarding={true}>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        {/* ── Settings & Profile ── */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute requireOnboarding={true}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requireOnboarding={true}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*"    element={<Navigate to="/404" replace />} />
      </Routes>
      </AppLayout>
    </HashRouter>
  )
}
