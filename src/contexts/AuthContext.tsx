import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

type AuthResult = {
  error: Error | null
  needsEmailConfirmation?: boolean
}

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const clearStaleAuthSessions = () => {
  const currentProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID
  if (!currentProjectId) return

  const currentPrefix = `sb-${currentProjectId}-`
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key.startsWith('sb-') && key.includes('-auth-token') && !key.startsWith(currentPrefix)) {
      localStorage.removeItem(key)
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = async (authUser: User) => {
    const fullName =
      typeof authUser.user_metadata?.full_name === 'string'
        ? authUser.user_metadata.full_name
        : authUser.email?.split('@')[0] ?? null

    await supabase.from('profiles').upsert(
      {
        id: authUser.id,
        full_name: fullName,
      },
      { onConflict: 'id' }
    )
  }

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      setProfile(data as Profile)
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    clearStaleAuthSessions()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)

      if (nextUser) {
        await ensureProfile(nextUser)
        await fetchProfile(nextUser.id)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession)
      const currentUser = currentSession?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        await ensureProfile(currentUser)
        await fetchProfile(currentUser.id)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, fullName: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    })

    if (!error && data.user && data.session) {
      await ensureProfile(data.user)
      await fetchProfile(data.user.id)
    }

    return {
      error: error as Error | null,
      needsEmailConfirmation: !error && !data.session,
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    // During HMR or error-boundary recovery the provider may not be mounted yet.
    // Return a safe no-op shell so the tree can render without crashing.
    return {
      session: null,
      user: null,
      profile: null,
      loading: true,
      signIn: async () => ({ error: new Error('Auth not ready') }),
      signUp: async () => ({ error: new Error('Auth not ready') }),
      signOut: async () => {},
      refreshProfile: async () => {},
    } as AuthContextType
  }
  return ctx
}
