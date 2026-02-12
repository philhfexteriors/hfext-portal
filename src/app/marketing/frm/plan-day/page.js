'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import ErrorMessage from '@/components/frm/ErrorMessage'

function PlanDayPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [frm, setFrm] = useState(null)
  const [zones, setZones] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [suggestedOption, setSuggestedOption] = useState(null)

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

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

      // Get FRM's assigned zones
      const { data: frmZones, error: zonesError } = await supabase
        .from('frm_zone_assignments')
        .select(`
          zone_id,
          route_zones (
            id,
            zone_name,
            zone_number
          )
        `)
        .eq('frm_id', frmData.id)

      if (zonesError) throw zonesError

      // Extract zones and sort by zone_number
      const zoneList = (frmZones || [])
        .map(fz => fz.route_zones)
        .filter(z => z !== null)
        .sort((a, b) => a.zone_number - b.zone_number)

      // Also fetch ALL zones in case FRM doesn't have specific assignments
      if (zoneList.length === 0) {
        const { fetchActiveZones } = await import('@/lib/frm/utils/fetchActiveZones')
        const { data: allZones, error: allZonesError } = await fetchActiveZones(supabase, {
          select: 'id, zone_name, zone_number'
        })

        if (allZonesError) throw allZonesError
        setZones(allZones || [])
      } else {
        setZones(zoneList)
      }

      // Get FRM's current progress
      const { data: progress } = await supabase
        .from('frm_progress')
        .select('current_zone_id, current_day_of_week, current_week_number')
        .eq('frm_id', frmData.id)
        .single()

      if (progress && progress.current_zone_id && progress.current_day_of_week) {
        // Calculate next suggested day
        const nextDay = progress.current_day_of_week < 5
          ? progress.current_day_of_week + 1
          : 1 // Wrap to Monday if finished Friday

        const nextZoneId = progress.current_day_of_week < 5
          ? progress.current_zone_id
          : progress.current_zone_id // Keep same zone (could be enhanced for multi-zone FRMs)

        setSuggestedOption({ zoneId: nextZoneId, day: nextDay })
        setSelectedZone(nextZoneId)
        setSelectedDay(nextDay)
      } else if (zoneList.length > 0) {
        // No progress, suggest first zone, day 1
        setSelectedZone(zoneList[0].id)
        setSelectedDay(1)
      }

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStartDay = () => {
    if (!selectedZone || !selectedDay) {
      alert('Please select a zone and day')
      return
    }

    router.push(`/today?zone=${selectedZone}&day=${selectedDay}`)
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plan Your Day</h1>
          <p className="text-gray-600">
            Select the zone and day you'll be working on
          </p>
        </div>

        {/* Zone & Day Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Suggested Option (if available) */}
          {suggestedOption && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-blue-900">Suggested Next Day</h3>
                  <p className="text-sm text-blue-700">
                    {zones.find(z => z.id === suggestedOption.zoneId)?.zone_name} - {dayNames[suggestedOption.day - 1]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Zone Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Zone
            </label>
            <select
              value={selectedZone || ''}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
            >
              <option value="">Choose a zone...</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.zone_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Day
            </label>
            <div className="grid grid-cols-5 gap-3">
              {dayNames.map((dayName, index) => {
                const dayNumber = index + 1
                const isSelected = selectedDay === dayNumber
                const isSuggested = suggestedOption && suggestedOption.day === dayNumber

                return (
                  <button
                    key={dayNumber}
                    onClick={() => setSelectedDay(dayNumber)}
                    className={`
                      py-4 px-3 rounded-lg font-medium text-sm transition-all
                      ${isSelected
                        ? 'bg-[#9D2235] text-white shadow-md'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-[#9D2235]'
                      }
                      ${isSuggested && !isSelected ? 'ring-2 ring-blue-400' : ''}
                    `}
                  >
                    <div className="text-center">
                      <div className="font-bold">{dayName.substring(0, 3)}</div>
                      <div className="text-xs opacity-75">{dayNumber}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {suggestedOption && <span className="text-blue-600">Blue ring = suggested next day</span>}
            </p>
          </div>

          {/* Start Day Button */}
          <button
            onClick={handleStartDay}
            disabled={!selectedZone || !selectedDay}
            className="w-full bg-gradient-to-r from-[#9D2235] to-[#C72C41] text-white py-4 px-6 rounded-lg font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Start Day
          </button>
        </div>

        {/* Help Text */}
        <div className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Select your zone and which day you're working on</li>
            <li>You'll see 17 agencies optimized for that day</li>
            <li>Visit each agency in order for minimal drive time</li>
            <li>Log visits as you go with our quick-log form</li>
            <li>Complete your day and get stats on your performance</li>
          </ol>
        </div>

        {/* Back to Home */}
        <button
          onClick={() => router.push('/marketing/frm')}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Back to Home
        </button>
      </div>
  )
}

export default function Page() {
  return (
    <AppShell fullWidth>
      <PlanDayPage />
    </AppShell>
  )
}
