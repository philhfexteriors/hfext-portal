'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Loading from '@/components/frm/Loading'

export default function DashboardRedirect() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If user is authenticated, redirect to home (which shows the dashboard)
    if (user) {
      router.replace('/marketing/frm')
    }
  }, [user, router])

  return <Loading />
}
