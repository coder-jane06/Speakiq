import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants'
import { Home, LayoutDashboard, Mic, User, Settings, Sparkles } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

/**
 * Clean, standard top navigation bar for web apps.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { theme } = useTheme()
  const { user } = useAuth()
  
  // Hide nav entirely on recording or login screens
  const hideNav = location.pathname.startsWith('/session') && !location.pathname.includes('/results')
  const hideCompletely = location.pathname === '/login'

  if (hideCompletely) return <>{children}</>;

  return (
    <div className={`flex flex-col min-h-screen bg-primary transition-colors duration-300 ${theme}`}>
      
      {!hideNav && (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-xl animate-fadeSlideUp h-[72px] flex items-center justify-between px-6 md:px-10">
          
          {/* Logo / Brand */}
          <NavLink to="/" className="flex items-center gap-3 font-[700] text-xl text-primary tracking-tight hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white dark:text-black flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            SpeakIQ
          </NavLink>

          {/* Center Navigation Links */}
          {user && (
            <nav className="hidden md:flex items-center gap-2">
              <NavItem to="/" icon={<Home size={18} strokeWidth={2.5} />} label="Home" />
              <NavItem to="/dashboard" icon={<LayoutDashboard size={18} strokeWidth={2.5} />} label="Dashboard" />
              
              <div className="w-[1px] h-6 bg-[var(--border-md)] mx-2" />
              
              <NavItem to="/profile" icon={<User size={18} strokeWidth={2.5} />} label="Profile" />
              <NavItem to="/settings" icon={<Settings size={18} strokeWidth={2.5} />} label="Settings" />
            </nav>
          )}

          {/* Right Action (Always visible) */}
          <NavLink
            to={user ? ROUTES.SESSION : ROUTES.LOGIN}
            className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-base)] px-5 py-2.5 rounded-full font-bold text-[14px] hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            <Mic size={18} strokeWidth={2.5} />
            <span className="hidden sm:inline">{user ? 'Start Session' : 'Sign In'}</span>
          </NavLink>

        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full mx-auto relative">
        {children}
      </div>

    </div>
  )
}

function NavItem({ to, icon, label }: { to: string, icon: ReactNode, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `flex items-center gap-2 px-4 py-2.5 rounded-[14px] transition-all duration-300 font-medium text-[14px] ${
          isActive && to === '/'
            // Special handling for home route matching exactly
            ? 'text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--border-accent)]' 
            : isActive
              ? 'text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--border-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}