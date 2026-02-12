'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import ErrorMessage from '@/components/frm/ErrorMessage'
import AgencyCard from '@/components/frm/AgencyCard'
import DaySummary from '@/components/frm/DaySummary'
import { calculateDistance, calculateTotalDistance } from '@/lib/frm/utils/distance'
import { getGoogleMapsDirectionsUrl } from '@/lib/frm/utils/maps'
import { usePullToRefresh } from '@/lib/frm/hooks/usePullToRefresh'
import { hapticLight } from '@/lib/frm/utils/haptics'
import toast from 'react-hot-toast'

function TodayPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const zoneId = searchParams.get('zone')
  const dayOfWeek = parseInt(searchParams.get('day'))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [frm, setFrm] = useState(null)
  const [zoneName, setZoneName] = useState('')
  const [agencies, setAgencies] = useState([])
  const [visitedToday, setVisitedToday] = useState(new Set())
  const [lastVisits, setLastVisits] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [todayVisits, setTodayVisits] = useState([])
  const [estimatedDriveMinutes, setEstimatedDriveMinutes] = useState(null)

  // Pull-to-refresh functionality
  const handleRefresh = useCallback(async () => {
    if (user && zoneId && dayOfWeek) {
      await fetchData()
      toast.success('Refreshed!')
    }
  }, [user, zoneId, dayOfWeek])

  const { refreshing, pullDistance } = usePullToRefresh(handleRefresh)

  useEffect(() => {
    if (user && zoneId && dayOfWeek) {
      fetchData()
    } else if (!zoneId || !dayOfWeek) {
      setError('Missing zone or day parameter')
      setLoading(false)
    }
  }, [user, zoneId, dayOfWeek])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get FRM record
      const { data: frmData, error: frmError } = await supabase
        .from('frms')
        .select('id, name')
        .eq('email', user.email)
        .single()

      if (frmError) throw frmError
      setFrm(frmData)

      // Get zone info
      const { data: zoneData, error: zoneError } = await supabase
        .from('route_zones')
        .select('zone_name')
        .eq('id', zoneId)
        .single()

      if (zoneError) throw zoneError
      setZoneName(zoneData.zone_name)

      // Get estimated drive time for this zone/day
      const { data: dailyStats } = await supabase
        .from('daily_route_stats')
        .select('estimated_drive_minutes')
        .eq('zone_id', zoneId)
        .eq('day_of_week', dayOfWeek)
        .order('optimization_version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dailyStats?.estimated_drive_minutes) {
        setEstimatedDriveMinutes(dailyStats.estimated_drive_minutes)
      }

      // Get agencies for this zone/day with assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('zone_assignments')
        .select(`
          *,
          agencies (
            id,
            name,
            address,
            city,
            state,
            zip,
            phone,
            latitude,
            longitude
          )
        `)
        .eq('zone_id', zoneId)
        .eq('day_of_week', dayOfWeek)
        .order('sequence_order')

      if (assignmentsError) throw assignmentsError

      const agencyList = (assignments || [])
        .map(a => a.agencies)
        .filter(a => a !== null)

      setAgencies(agencyList)

      // Get agency IDs for visit checks
      const agencyIds = agencyList.map(a => a.id)

      // Check which agencies have been visited TODAY by this FRM
      // Use local date to avoid timezone issues
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('agency_id, id, conversation_notes, visit_date')
        .eq('frm_id', frmData.id)
        .gte('visit_date', today)
        .in('agency_id', agencyIds)

      if (visitsError) throw visitsError

      const visitedSet = new Set((visitsData || []).map(v => v.agency_id))
      setVisitedToday(visitedSet)
      setTodayVisits(visitsData || [])

      // Get last visit for each agency (not necessarily today)
      const { data: lastVisitsData, error: lastVisitsError } = await supabase
        .from('visits')
        .select('agency_id, visit_date, conversation_notes')
        .in('agency_id', agencyIds)
        .order('visit_date', { ascending: false })

      if (!lastVisitsError && lastVisitsData) {
        // Create a map of agency_id -> most recent visit
        const lastVisitsMap = {}
        lastVisitsData.forEach(visit => {
          if (!lastVisitsMap[visit.agency_id]) {
            lastVisitsMap[visit.agency_id] = visit
          }
        })
        setLastVisits(lastVisitsMap)
      }

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVisitLogged = useCallback((agencyId, sequenceNumber) => {
    // Mark as visited
    setVisitedToday(prev => new Set([...prev, agencyId]))

    // Refresh today's visits for day summary
    // Use local date to avoid timezone issues
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    supabase
      .from('visits')
      .select('agency_id, id, conversation_notes, visit_date')
      .eq('frm_id', frm.id)
      .gte('visit_date', today)
      .then(({ data }) => {
        setTodayVisits(data || [])
      })

    // Find next agency
    const nextAgency = agencies[sequenceNumber + 1]

    if (nextAgency) {
      // Auto-prompt for directions to next agency
      const nextAgencyName = nextAgency.name
      const shouldGetDirections = window.confirm(
        `Visit logged! Get directions to ${nextAgencyName}?`
      )

      if (shouldGetDirections) {
        const url = getGoogleMapsDirectionsUrl(nextAgency.latitude, nextAgency.longitude)
        // Use window.location.href instead of window.open to avoid blank tabs on mobile
        window.location.href = url
      }
    } else {
      // Last agency - check if all visited
      checkDayCompletion()
    }
  }, [agencies, frm])

  const checkDayCompletion = useCallback(() => {
    const allVisited = agencies.every(a => visitedToday.has(a.id))
    if (allVisited && agencies.length > 0) {
      setShowSummary(true)
    }
  }, [agencies, visitedToday])

  // Check for day completion whenever visitedToday changes
  useEffect(() => {
    if (agencies.length > 0) {
      checkDayCompletion()
    }
  }, [visitedToday, agencies, checkDayCompletion])

  const handlePlanTomorrow = () => {
    router.push('/marketing/frm/plan-day')
  }

  const handleFinishDay = () => {
    router.push('/marketing/frm')
  }

  // Calculate distances between agencies
  const agenciesWithDistances = agencies.map((agency, index) => {
    const nextAgency = agencies[index + 1]
    const distanceToNext = nextAgency
      ? calculateDistance(
          agency.latitude,
          agency.longitude,
          nextAgency.latitude,
          nextAgency.longitude
        )
      : null

    return {
      ...agency,
      distanceToNext
    }
  })

  const totalDistance = calculateTotalDistance(
    agencies.map(a => ({ latitude: a.latitude, longitude: a.longitude }))
  )

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="pb-20">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 lg:left-64 z-[60] flex items-center justify-center bg-[#9D2235] text-white transition-all"
          style={{
            height: `${Math.min(pullDistance, 60)}px`,
            opacity: refreshing ? 1 : pullDistance / 80
          }}
        >
          {refreshing ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            pullDistance >= 80 && <span className="text-sm font-medium">Release to refresh</span>
          )}
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {zoneName} - {dayNames[dayOfWeek]}
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                {visitedToday.size} of {agencies.length} visited
                {estimatedDriveMinutes && (
                  <span className="ml-2 text-blue-600">• ~{Math.round(estimatedDriveMinutes)} min drive</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl md:text-4xl font-bold text-[#9D2235]">
                {visitedToday.size}/{agencies.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#9D2235] to-[#C72C41] h-full transition-all duration-500"
              style={{ width: `${(visitedToday.size / agencies.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Agency Cards */}
        <div className="space-y-4">
          {agenciesWithDistances.map((agency, index) => (
            <AgencyCard
              key={agency.id}
              agency={agency}
              sequenceNumber={index + 1}
              distanceToNext={agency.distanceToNext}
              lastVisit={lastVisits[agency.id] || null}
              isVisited={visitedToday.has(agency.id)}
              onVisitLogged={handleVisitLogged}
              frmId={frm?.id}
            />
          ))}
        </div>

        {/* Empty State */}
        {agencies.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No agencies scheduled
            </h3>
            <p className="text-gray-600 mb-4">
              There are no agencies assigned to this zone and day.
            </p>
            <button
              onClick={() => {
                hapticLight()
                router.push('/marketing/frm/plan-day')
              }}
              className="bg-[#9D2235] text-white py-2 px-6 rounded-lg hover:bg-[#8A1E2E] transition-colors"
            >
              Choose Different Day
            </button>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => {
            hapticLight()
            router.push('/marketing/frm/plan-day')
          }}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          ← Change Day
        </button>
      </div>

      {/* Day Summary Modal */}
      {showSummary && (
        <DaySummary
          zoneName={zoneName}
          dayOfWeek={dayOfWeek}
          totalAgencies={agencies.length}
          totalDistance={totalDistance}
          visits={todayVisits}
          onPlanTomorrow={handlePlanTomorrow}
          onFinishDay={handleFinishDay}
        />
      )}
    </div>
  )
}

export default function Page() {
  return (
    <AppShell fullWidth>
      <Suspense>
        <TodayPage />
      </Suspense>
    </AppShell>
  )
}
