'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserSession, AppAccess, UserRole } from '@/lib/auth/roles'

interface AuthContextType {
  user: User | null
  session: UserSession | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      setUser(authSession?.user ?? null)
      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, authSession) => {
      setUser(authSession?.user ?? null)
      if (_event === 'SIGNED_OUT') {
        setSession(null)
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

  // Fetch roles + accessible apps when user changes
  useEffect(() => {
    if (!user) {
      setSession(null)
      return
    }

    async function fetchSession() {
      // Get user's roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('roles(id, name, display_name)')
        .eq('user_id', user!.id)

      const roles: UserRole[] = (roleData || []).map((ur: Record<string, unknown>) => {
        const r = ur.roles as Record<string, unknown>
        return {
          id: r.id as string,
          name: r.name as string,
          display_name: r.display_name as string,
        }
      })

      // Get accessible apps with department info
      const roleIds = roles.map((r) => r.id)

      let apps: AppAccess[] = []

      if (roleIds.length > 0) {
        const { data: accessData } = await supabase
          .from('role_app_access')
          .select(
            'app_slug, apps(display_name, description, icon, base_path, sort_order, departments(slug, display_name, icon, sort_order))'
          )
          .in('role_id', roleIds)

        // Deduplicate apps (user might have multiple roles granting same app)
        const seen = new Set<string>()
        apps = (accessData || [])
          .filter((row: Record<string, unknown>) => {
            if (seen.has(row.app_slug as string)) return false
            seen.add(row.app_slug as string)
            return true
          })
          .map((row: Record<string, unknown>) => {
            const app = row.apps as Record<string, unknown>
            const dept = app.departments as Record<string, unknown>
            return {
              app_slug: row.app_slug as string,
              display_name: app.display_name as string,
              description: app.description as string | null,
              icon: app.icon as string | null,
              base_path: app.base_path as string,
              department_slug: dept.slug as string,
              department_name: dept.display_name as string,
              department_icon: dept.icon as string | null,
              department_sort: dept.sort_order as number,
              app_sort: app.sort_order as number,
            }
          })
      }

      setSession({ roles, apps })
    }

    fetchSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
