import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants'
import { Home, LayoutDashboard, Mic, User, Settings, Sparkles } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

/**
 * App layout: sticky top nav (desktop) + bottom tab bar (mobile).
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { theme } = useTheme()
  const { user } = useAuth()

  // Hide nav entirely during an active recording session
  const hideNav       = location.pathname.startsWith('/session') && !location.pathname.includes('/results')
  const hideCompletely = location.pathname === '/login' || location.pathname === '/onboarding'

  if (hideCompletely) return <>{children}</>

  return (
    <div className={`flex flex-col min-h-screen bg-primary transition-colors duration-300 ${theme}`}>

      {/* ── Desktop Top Nav ── */}
      {!hideNav && (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-xl animate-fadeSlideUp h-[72px] flex items-center justify-between px-6 md:px-10">

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 font-[700] text-xl text-primary tracking-tight hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white dark:text-black flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            SpeakIQ
          </NavLink>

          {/* Center Nav Links — desktop only */}
          {user && (
            <nav className="hidden md:flex items-center gap-2">
              <NavItem to="/" icon={<Home size={18} strokeWidth={2.5} />} label="Home" />
              <NavItem to="/dashboard" icon={<LayoutDashboard size={18} strokeWidth={2.5} />} label="Dashboard" />

              <div className="w-[1px] h-6 bg-[var(--border-md)] mx-2" />

              <NavItem to="/profile" icon={<User size={18} strokeWidth={2.5} />} label="Profile" />
              <NavItem to="/settings" icon={<Settings size={18} strokeWidth={2.5} />} label="Settings" />
            </nav>
          )}

          {/* CTA Button */}
          <NavLink
            to={user ? ROUTES.SESSION : ROUTES.LOGIN}
            className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-base)] px-5 py-2.5 rounded-full font-bold text-[14px] hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            <Mic size={18} strokeWidth={2.5} />
            <span className="hidden sm:inline">{user ? 'Start Session' : 'Sign In'}</span>
          </NavLink>

        </header>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 w-full mx-auto relative pb-20 md:pb-0">
        {children}
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      {!hideNav && user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-xl border-t border-[var(--border)] px-2 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center justify-around h-16">

            <MobileTabItem to="/"          icon={<Home         size={20} strokeWidth={2} />} label="Home"     />
            <MobileTabItem to="/dashboard" icon={<LayoutDashboard size={20} strokeWidth={2} />} label="Progress" />

            {/* Centre record FAB */}
            <NavLink to={ROUTES.SESSION} className="flex flex-col items-center justify-center -mt-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--bg-base)] flex items-center justify-center shadow-[0_0_24px_var(--accent-glow)] active:scale-90 transition-transform">
                <Mic size={24} strokeWidth={2.5} />
              </div>
            </NavLink>

            <MobileTabItem to="/profile"  icon={<User    size={20} strokeWidth={2} />} label="Profile"  />
            <MobileTabItem to="/settings" icon={<Settings size={20} strokeWidth={2} />} label="Settings" />

          </div>
        </nav>
      )}

    </div>
  )
}

/* ── Desktop NavItem ── */
function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-[14px] transition-all duration-200 font-medium text-[14px] border ${
          isActive
            ? 'text-[var(--accent)] bg-[var(--accent-dim)] border-[var(--border-accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

/* ── Mobile TabItem ── */
function MobileTabItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 transition-colors ${
          isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
        }`
      }
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  )
}
