import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants'
import {
  Home, LayoutDashboard, Mic, User, Settings,
  LogOut, Sun, Moon,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

/* ── nav structure ── */
const PRIMARY_NAV = [
  { to: '/',          icon: Home,            label: 'Home'      },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile',   icon: User,            label: 'Profile'   },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
]

/* ══════════════════════════════════════════════════════════════ */
export function AppLayout({ children }: { children: ReactNode }) {
  const location  = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { user, signOut }   = useAuth()
  const navigate  = useNavigate()

  /* Hide nav entirely on login / onboarding */
  const hideCompletely =
    location.pathname === '/login' || location.pathname === '/onboarding'

  /* Hide sidebar on session pages (keep immersive feel) but keep mobile tab */
  const hideSidebar =
    location.pathname.startsWith('/session') &&
    !location.pathname.includes('/results')

  if (hideCompletely) return <>{children}</>

  const isDark = theme !== 'light'

  const toggleMode = () => toggleTheme()

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.HOME)
  }

  return (
    <div className="app-shell">

      {/* ── LEFT SIDEBAR (desktop) ──────────────────────────── */}
      {!hideSidebar && (
        <aside className="sidebar">

          {/* Logo */}
          <div
            className="sidebar-logo flex items-center gap-3 px-5 py-5 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Fluently logo" 
              className="w-10 h-10 object-contain flex-shrink-0" 
            />
            <span
              className="sidebar-logo-text font-heading font-black text-[20px] tracking-tight bg-gradient-to-r from-[var(--gradient-hero-from)] to-[var(--gradient-hero-to)] bg-clip-text text-transparent"
            >
              Fluently
            </span>
          </div>

          {/* Primary nav */}
          <nav className="flex flex-col gap-1 px-3 pt-4 flex-1">
            {PRIMARY_NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <span className="sidebar-icon">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="sidebar-label">{label}</span>
              </NavLink>
            ))}

            {/* Practice CTA */}
            <NavLink
              to={ROUTES.SESSION}
              className="flex items-center gap-3 mt-3 px-4 py-3 rounded-[12px] font-semibold text-[14px] transition-all"
              style={{
                background:  'var(--accent)',
                color:       'var(--accent-text)',
                boxShadow:   '0 0 20px var(--accent-glow)',
              }}
            >
              <span className="sidebar-icon">
                <Mic size={18} strokeWidth={2.5} />
              </span>
              <span className="sidebar-label">Practice</span>
            </NavLink>
          </nav>

          {/* Bottom section */}
          <div
            className="sidebar-bottom flex flex-col gap-3 px-3 pb-5 border-t pt-4"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Theme toggle */}
            <button
              onClick={toggleMode}
              className="theme-toggle w-full"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="sidebar-label text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
              </span>
            </button>

            {/* User row */}
            {user && (
              <div
                className="flex items-center gap-3 px-2 py-2 rounded-[12px] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors group"
                onClick={handleSignOut}
                title="Sign out"
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                  style={{
                    background: 'var(--accent-dim)',
                    color:      'var(--accent)',
                    border:     '1px solid var(--border-accent)',
                  }}
                >
                  {user.email?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="sidebar-user-info flex-1 min-w-0 transition-all">
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {user.email}
                  </p>
                  <p
                    className="text-[11px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--red)' }}
                  >
                    <LogOut size={10} /> Sign out
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className={hideSidebar ? 'flex-1' : 'page-content'}>
        {children}
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────── */}
      {user && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t flex items-center justify-around px-2"
          style={{
            background:   'var(--bg-sidebar)',
            borderColor:  'var(--border)',
            height:       '60px',
            paddingBottom:'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <MobileTab to="/"          icon={<Home size={20} strokeWidth={2} />}            label="Home"     />
          <MobileTab to="/dashboard" icon={<LayoutDashboard size={20} strokeWidth={2} />} label="Progress" />

          {/* FAB */}
          <NavLink
            to={ROUTES.SESSION}
            className="flex flex-col items-center justify-center -mt-4"
          >
            <div
              className="w-13 h-13 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width:     '52px',
                height:    '52px',
                background: 'var(--accent)',
                color:      'var(--bg-base)',
                boxShadow: '0 0 20px var(--accent-glow)',
              }}
            >
              <Mic size={22} strokeWidth={2.5} />
            </div>
          </NavLink>

          <MobileTab to="/profile"  icon={<User     size={20} strokeWidth={2} />} label="Profile"  />
          <MobileTab to="/settings" icon={<Settings size={20} strokeWidth={2} />} label="More"     />
        </nav>
      )}
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */
function MobileTab({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 min-w-[52px] py-1 transition-colors ${
          isActive ? '' : ''
        }`
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
      })}
    >
      {icon}
      <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
    </NavLink>
  )
}
