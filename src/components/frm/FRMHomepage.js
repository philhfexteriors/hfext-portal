'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import Loading from './Loading'
import WeeklyGoalProgress from './WeeklyGoalProgress'

export default function FRMHomepage() {
  const { user } = useAuth()
  const [frm, setFrm] = useState(null)
  const [stats, setStats] = useState({
    visitsThisWeek: 0,
    visitedToday: 0,
    currentZone: null,
    currentDay: null
  })
  const [recentVisits, setRecentVisits] = useState([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchFRMData()
    }
  }, [user])

  const fetchFRMData = async () => {
    try {
      // Get FRM record
      const { data: frmData, error: frmError } = await supabase
        .from('frms')
        .select('id, name')
        .eq('email', user.email)
        .maybeSingle() // Use maybeSingle to handle case where user is not an FRM

      if (frmError) throw frmError

      // If no FRM record found, just show loading state is done
      if (!frmData) {
        setLoading(false)
        return
      }

      setFrm(frmData)

      // Get stats
      const today = new Date().toISOString().split('T')[0]
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString().split('T')[0]
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 }).toISOString().split('T')[0]

      // Visits this week
      const { count: weekCount } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('frm_id', frmData.id)
        .gte('visit_date', weekStart)
        .lte('visit_date', weekEnd)

      // Visits today
      const { count: todayCount } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('frm_id', frmData.id)
        .eq('visit_date', today)

      // Current progress
      const { data: progressData } = await supabase
        .from('frm_progress')
        .select(`
          current_day_of_week,
          route_zones (zone_name)
        `)
        .eq('frm_id', frmData.id)
        .maybeSingle() // Use maybeSingle in case no progress exists yet

      setStats({
        visitsThisWeek: weekCount || 0,
        visitedToday: todayCount || 0,
        currentZone: progressData?.route_zones?.zone_name || null,
        currentDay: progressData?.current_day_of_week || null
      })

      // Recent visits
      const { data: visitsData } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          conversation_notes,
          agencies (name, city, state)
        `)
        .eq('frm_id', frmData.id)
        .order('visit_date', { ascending: false })
        .limit(5)

      setRecentVisits(visitsData || [])

    } catch (error) {
      console.error('Error fetching FRM data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {frm?.name || 'there'}!
          </h1>
          <p className="text-gray-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Primary CTA - Plan My Day */}
        <Link
          href="/marketing/frm/plan-day"
          className="block bg-gradient-to-r from-[#9D2235] to-[#C72C41] text-white rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 p-8 text-center group"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="text-3xl font-bold">Plan My Day</h2>
          </div>
          <p className="text-white text-opacity-90">
            {stats.currentZone && stats.currentDay
              ? `Continue with ${stats.currentZone} - ${dayNames[stats.currentDay]}`
              : 'Start your optimized route'}
          </p>
        </Link>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl font-bold text-[#9D2235] mb-1">
              {stats.visitsThisWeek}
            </div>
            <div className="text-sm text-gray-600">Visits This Week</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl font-bold text-blue-600 mb-1">
              {stats.visitedToday}
            </div>
            <div className="text-sm text-gray-600">Visited Today</div>
          </div>
        </div>

        {/* Weekly Goal Progress */}
        {frm && <WeeklyGoalProgress frmId={frm.id} />}

        {/* Quick Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My Stats */}
          <Link
            href="/marketing/frm/my-stats"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-[#9D2235] bg-opacity-10 rounded-lg flex items-center justify-center group-hover:bg-opacity-20 transition-colors">
                <svg className="w-6 h-6 text-[#9D2235]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">My Stats</h3>
            </div>
            <p className="text-sm text-gray-600">
              View your visit analytics
            </p>
          </Link>

          {/* Agency Lookup */}
          <Link
            href="/marketing/frm/agency-lookup"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Agency Lookup</h3>
            </div>
            <p className="text-sm text-gray-600">
              Search agencies and view visit history
            </p>
          </Link>

          {/* Log Visit */}
          <Link
            href="/marketing/frm/log-visit"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Log Visit</h3>
            </div>
            <p className="text-sm text-gray-600">
              Record a new agency visit
            </p>
          </Link>

          {/* Data Entry */}
          <Link
            href="/marketing/frm/data-entry"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Data Entry</h3>
            </div>
            <p className="text-sm text-gray-600">
              Update agency information
            </p>
          </Link>
        </div>

        {/* Recent Activity */}
        {recentVisits.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentVisits.map(visit => (
                <div key={visit.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                  <div className="w-2 h-2 bg-[#9D2235] rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-gray-900">{visit.agencies?.name}</div>
                      <div className="text-sm text-gray-500 flex-shrink-0">
                        {format(new Date(visit.visit_date), 'MMM d')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {visit.agencies?.city}, {visit.agencies?.state}
                    </div>
                    {visit.conversation_notes && (
                      <div className="text-sm text-gray-500 italic mt-1 line-clamp-2">
                        {visit.conversation_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
