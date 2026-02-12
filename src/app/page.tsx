'use client'

import { useAuth } from '@/components/AuthProvider'
import { groupAppsByDepartment } from '@/lib/auth/roles'
import DepartmentCard from '@/components/DepartmentCard'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function HomeContent() {
  const { user, session, loading } = useAuth()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  if (!user || !session) {
    return null // middleware will redirect to login
  }

  const departments = groupAppsByDepartment(session.apps)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome,{' '}
              {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              H&F Exteriors Team Portal
            </p>
          </div>
          <button
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase/client')
              const supabase = createClient()
              await supabase.auth.signOut()
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>

        {error === 'no_access' && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            You don&apos;t have access to that app. Contact an admin to request access.
          </div>
        )}

        {/* Department sections */}
        {departments.length > 0 ? (
          <div className="space-y-8">
            {departments.map((dept) => (
              <DepartmentCard
                key={dept.slug}
                slug={dept.slug}
                name={dept.name}
                icon={dept.icon}
                apps={dept.apps}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">
              No apps assigned to your account yet. Contact an admin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
