import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  resendVerification: (email: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const clearAuth = () => {
    setSession(null)
    setUser(null)
    localStorage.removeItem('supabase_token')
    localStorage.removeItem('sb-' + new URL(import.meta.env.VITE_SUPABASE_URL ?? 'http://x').hostname + '-auth-token')
  }

  useEffect(() => {
    // Get initial session — if the stored refresh token is invalid, clear it silently
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // Refresh token is invalid — clear everything so no spammy retries
          clearAuth()
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.access_token) {
            localStorage.setItem('supabase_token', session.access_token)
          } else {
            localStorage.removeItem('supabase_token')
          }
        }
        setLoading(false)
      })
      .catch(() => {
        clearAuth()
        setLoading(false)
      })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.access_token) {
            localStorage.setItem('supabase_token', session.access_token)
          }
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
        } else if (event === 'USER_UPDATED') {
          setUser(session?.user ?? null)
        } else {
          // Handle TOKEN_REFRESH_FAILED and other edge cases
          setSession(session)
          setUser(session?.user ?? null)
          if (!session) {
            localStorage.removeItem('supabase_token')
          } else if (session.access_token) {
            localStorage.setItem('supabase_token', session.access_token)
          }
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const authRedirectUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString()

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, 
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
      }
    })
    if (error) throw error
    return { needsEmailConfirmation: !data.session }
  }

  const resendVerification = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    })
    if (error) throw error
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    localStorage.removeItem('supabase_token')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, resendVerification, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
