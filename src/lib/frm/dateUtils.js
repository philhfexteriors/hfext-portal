// Utility functions for handling dates correctly across timezones

/**
 * Get current date in YYYY-MM-DD format in local timezone
 * Use this when setting default dates or getting "today"
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC
 * Use this when displaying dates from the database
 *
 * Without this, "2026-02-05" gets parsed as UTC midnight,
 * which becomes Feb 4 in timezones behind UTC
 */
export function parseLocalDate(dateString) {
  if (!dateString) return null

  // If it's already a full ISO string with time, parse normally
  if (dateString.includes('T')) {
    return new Date(dateString)
  }

  // Otherwise, append midnight time to force local timezone interpretation
  return new Date(dateString + 'T00:00:00')
}
