'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const error = searchParams.get('error')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/')
      }
    })
  }, [router, supabase.auth])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: 'hfexteriors.com',
        },
      },
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #A30A32 0%, #495A66 100%)' }}
    >
      <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full m-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#A30A32' }}>
            H&F Exteriors
          </h1>
          <p className="text-gray-500 text-sm font-medium">Team Portal</p>
        </div>

        {error === 'unauthorized' && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            Only @hfexteriors.com accounts are allowed.
          </div>
        )}

        {error === 'no_access' && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm text-center">
            You don&apos;t have access to that app. Contact an admin.
          </div>
        )}

        <p className="text-gray-600 mb-8 text-center">
          Sign in with your H&F Exteriors account to continue
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full text-white py-4 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 cursor-pointer"
          style={{ backgroundColor: '#A30A32' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8A0829')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#A30A32')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="white"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="white"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="white"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="white"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
