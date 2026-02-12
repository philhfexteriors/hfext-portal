'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import ErrorMessage from '@/components/frm/ErrorMessage'
import ZoneMapLegend from '@/components/frm/ZoneMapLegend'
import AgencyMapDrawer from '@/components/frm/AgencyMapDrawer'
import { getZoneColor } from '@/lib/frm/utils/zoneColors'
import toast from 'react-hot-toast'

const ZoneMap = dynamic(() => import('@/components/frm/ZoneMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9D2235]"></div>
    </div>
  )
})

const CACHE_KEY = 'zoneMapCache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function loadFromCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached
  } catch {
    return null
  }
}

function saveToCache(zones, agenciesByZone, missingCount) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      zones,
      agenciesByZone,
      missingCount,
      timestamp: Date.now()
    }))
  } catch {
    // sessionStorage full or unavailable — not critical
  }
}

function ZoneMapPage() {
  const { user } = useAuth()
  const supabase = createClient()

  // Try to initialize from cache so the map appears instantly on back-navigation
  const cached = useMemo(() => loadFromCache(), [])

  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)
  const [zones, setZones] = useState(cached?.zones || [])
  const [agenciesByZone, setAgenciesByZone] = useState(cached?.agenciesByZone || {})
  const [visibleZones, setVisibleZones] = useState(
    new Set(cached?.zones?.map(z => z.id) || [])
  )
  const [selectedDay, setSelectedDay] = useState(null)
  const [missingCount, setMissingCount] = useState(cached?.missingCount || 0)
  const [drawerAgency, setDrawerAgency] = useState(null)
  const [drawerZoneId, setDrawerZoneId] = useState(null)

  useEffect(() => {
    if (user) {
      // If we have cached data, show it immediately and refresh in the background
      if (cached) {
        fetchData(true) // silent background refresh
      } else {
        fetchData(false)
      }
    }
  }, [user])

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      // Get FRM record
      const { data: frmData, error: frmError } = await supabase
        .from('frms')
        .select('id, name')
        .eq('email', user.email)
        .maybeSingle()

      if (frmError) throw frmError

      let zoneList = []

      if (frmData) {
        // Get FRM's assigned zones
        const { data: frmZones, error: zonesError } = await supabase
          .from('frm_zone_assignments')
          .select(`
            zone_id,
            route_zones (
              id,
              zone_name,
              zone_number,
              custom_name
            )
          `)
          .eq('frm_id', frmData.id)

        if (zonesError) throw zonesError

        zoneList = (frmZones || [])
          .map(fz => fz.route_zones)
          .filter(z => z !== null)
          .sort((a, b) => a.zone_number - b.zone_number)
      }

      // Fallback: if no FRM record or no zone assignments, load all zones
      if (zoneList.length === 0) {
        const { fetchActiveZones } = await import('@/lib/frm/utils/fetchActiveZones')
        const { data: allZones, error: allZonesError } = await fetchActiveZones(supabase, {
          select: 'id, zone_name, zone_number, custom_name'
        })

        if (allZonesError) throw allZonesError
        zoneList = allZones || []
      }

      setZones(zoneList)

      // Get all agency assignments for these zones
      const zoneIds = zoneList.map(z => z.id)

      if (zoneIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('zone_assignments')
        .select(`
          zone_id,
          agency_id,
          day_of_week,
          sequence_order,
          agencies (
            id,
            name,
            address,
            city,
            state,
            zip,
            phone,
            latitude,
            longitude,
            is_active
          )
        `)
        .in('zone_id', zoneIds)
        .order('day_of_week')
        .order('sequence_order')

      if (assignmentsError) throw assignmentsError

      // Group by zone
      const grouped = {}
      let missing = 0

      for (const assignment of (assignments || [])) {
        const agency = assignment.agencies
        if (!agency) continue
        if (agency.is_active === false) continue

        const zoneId = assignment.zone_id
        if (!grouped[zoneId]) {
          grouped[zoneId] = { agencies: [], dayAgencies: {}, seenIds: new Set() }
        }

        const agencyWithMeta = {
          ...agency,
          day_of_week: assignment.day_of_week,
          sequence_order: assignment.sequence_order
        }

        // Track missing coordinates
        if (!agency.latitude || !agency.longitude) {
          missing++
        }

        // Add to day-specific list
        const day = assignment.day_of_week
        if (day) {
          if (!grouped[zoneId].dayAgencies[day]) {
            grouped[zoneId].dayAgencies[day] = []
          }
          grouped[zoneId].dayAgencies[day].push(agencyWithMeta)
        }

        // Add to all-agencies list (deduplicated)
        if (!grouped[zoneId].seenIds.has(agency.id)) {
          grouped[zoneId].seenIds.add(agency.id)
          grouped[zoneId].agencies.push(agencyWithMeta)
        }
      }

      // Clean up seenIds sets before setting state
      for (const zoneId of Object.keys(grouped)) {
        delete grouped[zoneId].seenIds
      }

      setAgenciesByZone(grouped)
      setMissingCount(missing)

      // All zones visible by default (only on fresh load, not background refresh)
      if (!silent) {
        setVisibleZones(new Set(zoneIds))
      }

      // Cache data so navigating away and back is instant
      saveToCache(zoneList, grouped, missing)

    } catch (err) {
      console.error('Error fetching zone map data:', err)
      setError(err.message)
      toast.error('Failed to load zone map data')
    } finally {
      setLoading(false)
    }
  }

  // Build zone color map
  const zoneColorMap = useMemo(() => {
    const map = {}
    zones.forEach((zone, index) => {
      map[zone.id] = getZoneColor(index)
    })
    return map
  }, [zones])

  const toggleZone = (zoneId) => {
    setVisibleZones(prev => {
      const next = new Set(prev)
      if (next.has(zoneId)) {
        next.delete(zoneId)
      } else {
        next.add(zoneId)
      }
      return next
    })
  }

  const handleAgencyClick = (agency, zoneId) => {
    setDrawerAgency(agency)
    setDrawerZoneId(zoneId)
  }

  const handleAgencyUpdated = (updatedAgency) => {
    // Update the agency in agenciesByZone state so the map reflects changes
    setAgenciesByZone(prev => {
      const next = { ...prev }
      for (const zoneId of Object.keys(next)) {
        const zoneData = next[zoneId]

        // Update in the all-agencies list
        const idx = zoneData.agencies.findIndex(a => a.id === updatedAgency.id)
        if (idx !== -1) {
          const updated = { ...zoneData.agencies[idx], ...updatedAgency }
          next[zoneId] = {
            ...zoneData,
            agencies: [...zoneData.agencies.slice(0, idx), updated, ...zoneData.agencies.slice(idx + 1)],
            dayAgencies: { ...zoneData.dayAgencies }
          }

          // Also update in day lists
          for (const day of Object.keys(next[zoneId].dayAgencies)) {
            const dayIdx = next[zoneId].dayAgencies[day].findIndex(a => a.id === updatedAgency.id)
            if (dayIdx !== -1) {
              const updatedDay = { ...next[zoneId].dayAgencies[day][dayIdx], ...updatedAgency }
              next[zoneId].dayAgencies[day] = [
                ...next[zoneId].dayAgencies[day].slice(0, dayIdx),
                updatedDay,
                ...next[zoneId].dayAgencies[day].slice(dayIdx + 1)
              ]
            }
          }
        }
      }
      return next
    })

    // Update the drawer agency too so it reflects the saved data
    setDrawerAgency(updatedAgency)

    // Invalidate cache so next load picks up the changes
    sessionStorage.removeItem(CACHE_KEY)
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (zones.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Zone Map</h1>
          <p className="text-gray-600">No zones assigned yet. Contact your admin to set up zone assignments.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-56px)] lg:h-screen">
      <ZoneMap
        zones={zones}
        agenciesByZone={agenciesByZone}
        visibleZones={visibleZones}
        selectedDay={selectedDay}
        zoneColors={zoneColorMap}
        onAgencyClick={handleAgencyClick}
      />
      <ZoneMapLegend
        zones={zones}
        visibleZones={visibleZones}
        onToggleZone={toggleZone}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        zoneColors={zoneColorMap}
        agenciesByZone={agenciesByZone}
        missingCount={missingCount}
      />
      {drawerAgency && (
        <AgencyMapDrawer
          agency={drawerAgency}
          zoneColor={drawerZoneId ? zoneColorMap[drawerZoneId] : null}
          zoneName={(() => {
            const zone = zones.find(z => z.id === drawerZoneId)
            return zone?.custom_name || zone?.zone_name || 'Unknown Zone'
          })()}
          onClose={() => { setDrawerAgency(null); setDrawerZoneId(null) }}
          onAgencyUpdated={handleAgencyUpdated}
        />
      )}
    </div>
  )
}

export default function Page() {
  return (
    <AppShell fullWidth>
      <ZoneMapPage />
    </AppShell>
  )
}
