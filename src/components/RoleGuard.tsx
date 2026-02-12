'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { hasAppAccess, isAdmin } from '@/lib/auth/roles'

interface RoleGuardProps {
  children: React.ReactNode
  appSlug: string
}

export default function RoleGuard({ children, appSlug }: RoleGuardProps) {
  const { user, session } = useAuth()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!user || !session) return

    if (isAdmin(session) || hasAppAccess(session, appSlug)) {
      setAuthorized(true)
      return
    }

    // Not authorized — redirect to home
    router.replace('/?error=no_access')
  }, [user, session, appSlug, router])

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Checking permissions...</div>
      </div>
    )
  }

  return <>{children}</>
}
