/**
 * Database query functions for weekly email metrics
 * Optimized for server-side execution with Supabase
 */

import { createClient } from '@/lib/supabase/frm-server'

/**
 * Get all active FRMs
 * @returns {Promise<Array>} Array of active FRM objects
 */
export async function getActiveFRMs() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('frms')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) {
    console.error('Error fetching active FRMs:', error)
    throw error
  }

  return data || []
}

/**
 * Get total visit count for an FRM in a date range
 * @param {number} frmId
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<number>} Total visit count
 */
export async function getFRMWeeklyMetrics(frmId, startDate, endDate) {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('frm_id', frmId)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)

  if (error) {
    console.error(`Error fetching weekly metrics for FRM ${frmId}:`, error)
    throw error
  }

  return count || 0
}

/**
 * Get daily visit breakdown for an FRM (Monday-Friday)
 * @param {number} frmId
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<Array>} Array of {date, dayName, visitCount}
 */
export async function getDailyVisitBreakdown(frmId, startDate, endDate) {
  const supabase = await createClient()

  // Get all visits in range
  const { data, error } = await supabase
    .from('visits')
    .select('visit_date')
    .eq('frm_id', frmId)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)
    .order('visit_date')

  if (error) {
    console.error(`Error fetching daily breakdown for FRM ${frmId}:`, error)
    throw error
  }

  // Count visits by day
  const visitsByDay = {}
  data.forEach(visit => {
    visitsByDay[visit.visit_date] = (visitsByDay[visit.visit_date] || 0) + 1
  })

  // Generate Monday-Friday entries
  const breakdown = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // Only include Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = d.toISOString().split('T')[0]
      breakdown.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        visitCount: visitsByDay[dateStr] || 0
      })
    }
  }

  return breakdown
}

/**
 * Get daily visit breakdown for all active FRMs combined
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<Array>} Array of {date, dayName, visitCount}
 */
export async function getDailyVisitBreakdownAllFRMs(startDate, endDate) {
  const supabase = await createClient()

  // Get all visits in range for active FRMs
  const { data: visits, error } = await supabase
    .from('visits')
    .select(`
      visit_date,
      frms!inner(active)
    `)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)
    .eq('frms.active', true)

  if (error) {
    console.error('Error fetching daily breakdown for all FRMs:', error)
    throw error
  }

  // Count visits by day
  const visitsByDay = {}
  visits.forEach(visit => {
    visitsByDay[visit.visit_date] = (visitsByDay[visit.visit_date] || 0) + 1
  })

  // Generate Monday-Friday entries
  const breakdown = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // Only include Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = d.toISOString().split('T')[0]
      breakdown.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        visitCount: visitsByDay[dateStr] || 0
      })
    }
  }

  return breakdown
}

/**
 * Get visit counts for all active FRMs in a date range
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<Array>} Array of {frmId, frmName, visitCount}
 */
export async function getAllFRMsWeeklyBreakdown(startDate, endDate) {
  const supabase = await createClient()

  // Get all active FRMs
  const activeFRMs = await getActiveFRMs()

  // Get visit counts for each FRM in parallel
  const breakdownPromises = activeFRMs.map(async (frm) => {
    const visitCount = await getFRMWeeklyMetrics(frm.id, startDate, endDate)
    return {
      frmId: frm.id,
      frmName: frm.name,
      frmEmail: frm.email,
      visitCount
    }
  })

  const breakdown = await Promise.all(breakdownPromises)

  // Sort by visit count descending
  return breakdown.sort((a, b) => b.visitCount - a.visitCount)
}

/**
 * Get week-over-week change for an FRM
 * @param {number} frmId
 * @param {string} currentWeekStart - ISO date string
 * @param {string} currentWeekEnd - ISO date string
 * @returns {Promise<{change: number, percentage: number}>} Absolute change and percentage
 */
export async function getWeekOverWeekChange(frmId, currentWeekStart, currentWeekEnd) {
  const supabase = await createClient()

  // Get current week count
  const currentCount = await getFRMWeeklyMetrics(frmId, currentWeekStart, currentWeekEnd)

  // Calculate previous week dates
  const prevWeekStart = new Date(currentWeekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekEnd = new Date(currentWeekEnd)
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7)

  // Get previous week count
  const previousCount = await getFRMWeeklyMetrics(
    frmId,
    prevWeekStart.toISOString().split('T')[0],
    prevWeekEnd.toISOString().split('T')[0]
  )

  const change = currentCount - previousCount
  const percentage = previousCount === 0 ? 0 : ((change / previousCount) * 100)

  return {
    change,
    percentage: Math.round(percentage),
    currentCount,
    previousCount
  }
}

/**
 * Get week-over-week change for all active FRMs combined
 * @param {string} currentWeekStart - ISO date string
 * @param {string} currentWeekEnd - ISO date string
 * @returns {Promise<{change: number, percentage: number}>} Absolute change and percentage
 */
export async function getWeekOverWeekChangeAllFRMs(currentWeekStart, currentWeekEnd) {
  const supabase = await createClient()

  // Get current week count for all active FRMs
  const { count: currentCount, error: currentError } = await supabase
    .from('visits')
    .select(`
      *,
      frms!inner(active)
    `, { count: 'exact', head: true })
    .gte('visit_date', currentWeekStart)
    .lte('visit_date', currentWeekEnd)
    .eq('frms.active', true)

  if (currentError) {
    console.error('Error fetching current week count:', currentError)
    throw currentError
  }

  // Calculate previous week dates
  const prevWeekStart = new Date(currentWeekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekEnd = new Date(currentWeekEnd)
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7)

  // Get previous week count for all active FRMs
  const { count: previousCount, error: previousError } = await supabase
    .from('visits')
    .select(`
      *,
      frms!inner(active)
    `, { count: 'exact', head: true })
    .gte('visit_date', prevWeekStart.toISOString().split('T')[0])
    .lte('visit_date', prevWeekEnd.toISOString().split('T')[0])
    .eq('frms.active', true)

  if (previousError) {
    console.error('Error fetching previous week count:', previousError)
    throw previousError
  }

  const change = (currentCount || 0) - (previousCount || 0)
  const percentage = previousCount === 0 ? 0 : ((change / previousCount) * 100)

  return {
    change,
    percentage: Math.round(percentage),
    currentCount: currentCount || 0,
    previousCount: previousCount || 0
  }
}

/**
 * Get year-to-date visit count for an FRM
 * @param {number} frmId
 * @param {string} yearStart - ISO date string (e.g., "2025-01-01")
 * @returns {Promise<number>} YTD visit count
 */
export async function getYTDVisitCount(frmId, yearStart) {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('frm_id', frmId)
    .gte('visit_date', yearStart)
    .lte('visit_date', today)

  if (error) {
    console.error(`Error fetching YTD count for FRM ${frmId}:`, error)
    throw error
  }

  return count || 0
}
