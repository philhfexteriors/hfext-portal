/**
 * Date utility functions for weekly email reports
 */

/**
 * Get the date range for the previous week (Sunday - Saturday)
 * @returns {{ startDate: string, endDate: string }} ISO date strings
 */
export function getPreviousWeekRange() {
  const now = new Date()

  // Get last Sunday
  const dayOfWeek = now.getDay()
  const lastSunday = new Date(now)
  lastSunday.setDate(now.getDate() - dayOfWeek - 7)
  lastSunday.setHours(0, 0, 0, 0)

  // Get last Saturday
  const lastSaturday = new Date(lastSunday)
  lastSaturday.setDate(lastSunday.getDate() + 6)
  lastSaturday.setHours(23, 59, 59, 999)

  return {
    startDate: lastSunday.toISOString().split('T')[0],
    endDate: lastSaturday.toISOString().split('T')[0]
  }
}

/**
 * Format date range for display in emails
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {string} Formatted date range (e.g., "Jan 1 - Jan 7, 2025")
 */
export function formatDateRange(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const options = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', options)
  const endStr = end.toLocaleDateString('en-US', options)
  const year = end.getFullYear()

  return `${startStr} - ${endStr}, ${year}`
}

/**
 * Get the week number for a given date
 * @param {Date} date
 * @returns {number} Week number (1-52)
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

/**
 * Get start of year date for YTD calculations
 * @returns {string} ISO date string for January 1st of current year
 */
export function getYearStart() {
  const now = new Date()
  return `${now.getFullYear()}-01-01`
}

/**
 * Get day of week name from date
 * @param {string} dateString - ISO date string
 * @returns {string} Day name (e.g., "Monday")
 */
export function getDayName(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Get all dates in a range
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {string[]} Array of ISO date strings
 */
export function getDateRange(startDate, endDate) {
  const dates = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}
