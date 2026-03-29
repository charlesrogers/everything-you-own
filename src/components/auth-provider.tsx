'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { USE_SUPABASE } from '@/lib/feature-flags'

interface AuthContextValue {
  user: User | null
  userId: string | null
  householdId: string | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: null,
  householdId: null,
  isLoading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!USE_SUPABASE) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    async function loadSession() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        setUser(currentUser)

        if (currentUser) {
          const { data: membership } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', currentUser.id)
            .limit(1)
            .single()

          setHouseholdId(membership?.household_id ?? null)
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null
        setUser(newUser)

        if (!newUser && _event === 'SIGNED_OUT') {
          setHouseholdId(null)
        }
        // Don't re-fetch householdId on token refresh — it doesn't change
        // and the query can fail during the brief token transition window
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setHouseholdId(null)
  }

  return (
    <AuthContext.Provider value={{ user, userId: user?.id ?? null, householdId, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
