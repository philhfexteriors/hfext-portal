import { createClient } from '@/lib/supabase/frm-server'
import { isAdmin } from '@/lib/frm/auth/roles'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { optimizeRoutes } from '@/lib/services/frm/routeOptimizer'

// Allow up to 60 seconds for optimization (Vercel Pro)
export const maxDuration = 60

export async function POST(request) {
  const startTime = Date.now()
  const supabase = await createClient()

  // Verify admin user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Fetch all geocoded active agencies (exclude inactive)
    const { data: agencies, error: fetchError } = await supabase
      .from('agencies')
      .select('id, name, address, city, state, zip, latitude, longitude')
      .eq('geocoded', true)
      .neq('is_active', false)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    if (!agencies || agencies.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No geocoded agencies found. Please run batch geocoding first.'
      }, { status: 400 })
    }

    console.log(`Found ${agencies.length} geocoded agencies, starting optimization...`)

    // Get Google API key for drive-time optimization
    const googleApiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_PLACES_API_KEY || null

    // Run the optimization algorithm - 11 zones, 1 FRM, 17/day
    // Pass supabase and API key for drive-time optimization
    const { zones, frmAssignments, stats } = await optimizeRoutes(
      agencies,
      {
        agenciesPerDay: 17,
        numZones: 11,
        numFRMs: 1
      },
      googleApiKey ? supabase : null,
      googleApiKey
    )

    console.log(`Optimization created ${zones.length} zones for ${stats.numFRMs} FRMs`)
    console.log(`Algorithm: ${stats.algorithm}`)

    // Get current max optimization version
    const { data: historyData } = await supabase
      .from('optimization_history')
      .select('optimization_version')
      .order('optimization_version', { ascending: false })
      .limit(1)

    const newVersion = (historyData && historyData[0]?.optimization_version || 0) + 1

    console.log(`Creating optimization version ${newVersion}`)

    // Deactivate all old zones from previous versions
    const { error: deactivateError } = await supabase
      .from('route_zones')
      .update({ is_active: false })
      .lt('optimization_version', newVersion)

    if (deactivateError) {
      console.error('Warning: Failed to deactivate old zones:', deactivateError)
      // Non-fatal - continue with optimization
    } else {
      console.log('Deactivated old zone versions')
    }

    // Save zones to database
    const assignmentInserts = []
    const dailyStatsInserts = []

    for (const zone of zones) {
      // Determine which FRM this zone belongs to
      const frmNum = frmAssignments.find(f =>
        f.zones.includes(zone.zoneName)
      )?.frmNumber || null

      // Insert route_zone
      const { data: zoneData, error: zoneError } = await supabase
        .from('route_zones')
        .insert({
          zone_name: zone.zoneName,
          zone_number: zone.zoneNumber,
          frm_number: frmNum,
          optimization_version: newVersion,
          last_optimized_at: new Date().toISOString(),
          optimization_notes: `${stats.algorithm}, FRM ${frmNum}, ${zone.totalAgencies} agencies, ${zone.totalDays} days`
        })
        .select()
        .single()

      if (zoneError) {
        console.error('Error inserting zone:', zoneError)
        throw zoneError
      }

      console.log(`Created zone: ${zone.zoneName} (FRM ${frmNum}, ${zone.totalAgencies} agencies)`)

      // Insert zone_assignments for this zone
      for (const dailyAssignment of zone.dailyAssignments) {
        for (const agency of dailyAssignment.agencies) {
          assignmentInserts.push({
            zone_id: zoneData.id,
            agency_id: agency.id,
            day_of_week: dailyAssignment.dayOfWeek,
            week_number: dailyAssignment.weekNumber,
            assignment_type: 'optimized',
            sequence_order: agency.sequenceOrder,
            optimization_version: newVersion,
            assigned_by: user.email,
            latitude: agency.latitude,
            longitude: agency.longitude
          })
        }

        // Collect daily stats for this day-group
        if (dailyAssignment.estimatedDriveMinutes) {
          dailyStatsInserts.push({
            zone_id: zoneData.id,
            day_of_week: dailyAssignment.dayOfWeek,
            week_number: dailyAssignment.weekNumber,
            optimization_version: newVersion,
            estimated_drive_minutes: dailyAssignment.estimatedDriveMinutes,
            estimated_distance_miles: dailyAssignment.estimatedDistanceMiles,
            agency_count: dailyAssignment.agencies.length
          })
        }
      }
    }

    // Batch insert assignments (in chunks to avoid payload limits)
    console.log(`Inserting ${assignmentInserts.length} zone assignments...`)

    const CHUNK_SIZE = 500
    for (let i = 0; i < assignmentInserts.length; i += CHUNK_SIZE) {
      const chunk = assignmentInserts.slice(i, i + CHUNK_SIZE)
      const { error: assignmentError } = await supabase
        .from('zone_assignments')
        .insert(chunk)

      if (assignmentError) {
        console.error(`Error inserting assignments chunk ${i / CHUNK_SIZE + 1}:`, assignmentError)
        throw assignmentError
      }
    }

    // Insert daily route stats
    if (dailyStatsInserts.length > 0) {
      console.log(`Inserting ${dailyStatsInserts.length} daily route stats...`)
      for (let i = 0; i < dailyStatsInserts.length; i += CHUNK_SIZE) {
        const chunk = dailyStatsInserts.slice(i, i + CHUNK_SIZE)
        const { error: statsError } = await supabase
          .from('daily_route_stats')
          .insert(chunk)

        if (statsError) {
          console.error('Error inserting daily stats:', statsError)
          // Non-fatal - don't throw, just log
        }
      }
    }

    // Save optimization history
    const executionTime = Date.now() - startTime

    const { error: historyError } = await supabase
      .from('optimization_history')
      .insert({
        optimization_version: newVersion,
        total_agencies: stats.totalAgencies,
        total_zones: stats.zonesCreated,
        agencies_per_day_target: 17,
        algorithm_used: stats.algorithm,
        actual_agencies_per_day: { target: 17 },
        zone_stats: zones.map(z => ({
          zoneNumber: z.zoneNumber,
          zoneName: z.zoneName,
          totalAgencies: z.totalAgencies,
          avgDriveMinutes: z.dailyStats
            ? Math.round(z.dailyStats.filter(d => d.estimatedDriveMinutes).reduce((s, d) => s + d.estimatedDriveMinutes, 0) / Math.max(z.dailyStats.filter(d => d.estimatedDriveMinutes).length, 1) * 10) / 10
            : null
        })),
        triggered_by: user.email,
        execution_time_ms: executionTime,
        notes: `${stats.totalAgencies} agencies → ${stats.zonesCreated} zones, ${stats.algorithm}, city splits: ${stats.citySplits}/${stats.totalCities}${stats.avgDailyDriveMinutes ? `, avg drive: ${stats.avgDailyDriveMinutes}min` : ''}`
      })

    if (historyError) {
      console.error('Error saving history:', historyError)
      throw historyError
    }

    console.log(`Optimization complete in ${executionTime}ms`)

    return NextResponse.json({
      success: true,
      message: `Successfully optimized ${stats.totalAgencies} agencies into ${stats.zonesCreated} zones`,
      optimizationVersion: newVersion,
      stats,
      zones: zones.map(z => ({
        zoneNumber: z.zoneNumber,
        zoneName: z.zoneName,
        totalAgencies: z.totalAgencies,
        avgDriveMinutes: z.dailyStats
          ? Math.round(z.dailyStats.filter(d => d.estimatedDriveMinutes).reduce((s, d) => s + d.estimatedDriveMinutes, 0) / Math.max(z.dailyStats.filter(d => d.estimatedDriveMinutes).length, 1) * 10) / 10
          : null
      })),
      frmAssignments: frmAssignments.map(f => ({
        frmName: f.frmName,
        zones: f.zones,
        totalAgencies: f.totalAgencies
      })),
      executionTimeMs: executionTime
    })

  } catch (error) {
    console.error('Route optimization error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Route optimization failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current optimization stats
export async function GET(request) {
  const supabase = await createClient()

  // Verify admin user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Get latest optimization version
    const { data: latestHistory } = await supabase
      .from('optimization_history')
      .select('*')
      .order('optimization_version', { ascending: false })
      .limit(1)
      .single()

    if (!latestHistory) {
      return NextResponse.json({
        hasOptimization: false,
        message: 'No optimization has been run yet'
      })
    }

    // Get zones for current version with agency counts
    const { data: zones } = await supabase
      .from('route_zones')
      .select('*')
      .eq('optimization_version', latestHistory.optimization_version)
      .eq('is_active', true)
      .order('zone_number')

    // Get agency counts for each zone
    const zonesWithCounts = await Promise.all(
      (zones || []).map(async (zone) => {
        const { count } = await supabase
          .from('zone_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('zone_id', zone.id)
          .eq('optimization_version', latestHistory.optimization_version)

        // Get daily route stats for this zone
        const { data: dailyStats } = await supabase
          .from('daily_route_stats')
          .select('estimated_drive_minutes, estimated_distance_miles, day_of_week, week_number')
          .eq('zone_id', zone.id)
          .eq('optimization_version', latestHistory.optimization_version)

        const avgDriveMinutes = dailyStats && dailyStats.length > 0
          ? Math.round(dailyStats.reduce((s, d) => s + (d.estimated_drive_minutes || 0), 0) / dailyStats.length * 10) / 10
          : null

        return {
          ...zone,
          agencyCount: count || 0,
          avgDriveMinutes,
          dailyStatsCount: dailyStats?.length || 0
        }
      })
    )

    // Group zones by FRM
    const frmGroups = {}
    for (const zone of zonesWithCounts) {
      const frmNum = zone.frm_number || 0
      if (!frmGroups[frmNum]) {
        frmGroups[frmNum] = {
          frmNumber: frmNum,
          frmName: `FRM ${frmNum}`,
          zones: [],
          totalAgencies: 0
        }
      }
      frmGroups[frmNum].zones.push(zone)
      frmGroups[frmNum].totalAgencies += zone.agencyCount
    }

    return NextResponse.json({
      hasOptimization: true,
      currentVersion: latestHistory.optimization_version,
      optimizedAt: latestHistory.created_at,
      triggeredBy: latestHistory.triggered_by,
      stats: {
        totalAgencies: latestHistory.total_agencies,
        totalZones: latestHistory.total_zones,
        algorithmUsed: latestHistory.algorithm_used,
        executionTimeMs: latestHistory.execution_time_ms,
        zoneStats: latestHistory.zone_stats,
        notes: latestHistory.notes
      },
      zones: zonesWithCounts,
      frmGroups: Object.values(frmGroups).sort((a, b) => a.frmNumber - b.frmNumber)
    })

  } catch (error) {
    console.error('Error fetching optimization stats:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Failed to fetch optimization stats', details: error.message },
      { status: 500 }
    )
  }
}
