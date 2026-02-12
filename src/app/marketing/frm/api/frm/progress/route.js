import { createClient } from '@/lib/supabase/frm-server'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

/**
 * GET /api/frm/progress?frmId=X
 * Fetch FRM's current progress and calculate next suggested day
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const frmId = searchParams.get('frmId')

    if (!frmId) {
      return NextResponse.json(
        { error: 'frmId parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get FRM's current progress
    const { data: progress, error: progressError } = await supabase
      .from('frm_progress')
      .select('*')
      .eq('frm_id', frmId)
      .single()

    // If no progress record exists (first-time user), return null
    if (progressError && progressError.code === 'PGRST116') {
      return NextResponse.json({
        progress: null,
        nextSuggestion: null,
        message: 'No progress found - first time user'
      })
    }

    if (progressError) {
      throw progressError
    }

    // Calculate next suggested day
    const nextSuggestion = calculateNextDay(progress)

    return NextResponse.json({
      progress,
      nextSuggestion
    })

  } catch (error) {
    console.error('Error fetching FRM progress:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Failed to fetch FRM progress', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/frm/progress
 * Manually update FRM progress (optional, mainly for admin overrides)
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { frmId, zoneId, dayOfWeek, weekNumber } = body

    if (!frmId) {
      return NextResponse.json(
        { error: 'frmId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Upsert progress record
    const { data, error } = await supabase
      .from('frm_progress')
      .upsert({
        frm_id: frmId,
        current_zone_id: zoneId || null,
        current_day_of_week: dayOfWeek || null,
        current_week_number: weekNumber || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'frm_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      progress: data
    })

  } catch (error) {
    console.error('Error updating FRM progress:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Failed to update FRM progress', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Calculate the next suggested zone/day based on current progress
 * @param {Object} progress - Current FRM progress record
 * @returns {Object} Next suggested zone, day, and week
 */
function calculateNextDay(progress) {
  if (!progress) return null

  const { current_zone_id, current_day_of_week, current_week_number } = progress

  // If we have a current day, suggest the next day
  if (current_day_of_week) {
    if (current_day_of_week < 5) {
      // Same zone, next day (Mon-Thu → next day)
      return {
        zoneId: current_zone_id,
        dayOfWeek: current_day_of_week + 1,
        weekNumber: current_week_number
      }
    } else {
      // End of week (Friday → Monday next week)
      // Note: This assumes FRM stays in same zone for now
      // If FRM has multiple zones, this logic would need to cycle to next zone
      return {
        zoneId: current_zone_id,
        dayOfWeek: 1, // Monday
        weekNumber: (current_week_number || 1) + 1
      }
    }
  }

  // No current day, suggest Day 1
  return {
    zoneId: current_zone_id,
    dayOfWeek: 1,
    weekNumber: current_week_number || 1
  }
}
