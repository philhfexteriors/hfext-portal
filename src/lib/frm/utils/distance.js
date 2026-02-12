/**
 * Distance calculation utilities using the Haversine formula
 * for calculating great-circle distances between two points on Earth
 */

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lon1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lon2 - Longitude of second point in degrees
 * @returns {number} Distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth radius in miles

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Format distance for display
 * @param {number} miles - Distance in miles
 * @returns {string} Formatted distance string (e.g., "2.3 mi", "0.5 mi")
 */
export function formatDistance(miles) {
  if (miles === null || miles === undefined || isNaN(miles)) {
    return '--'
  }

  return `${miles.toFixed(1)} mi`
}

/**
 * Calculate total distance for an array of locations
 * @param {Array} locations - Array of {latitude, longitude} objects
 * @returns {number} Total distance in miles
 */
export function calculateTotalDistance(locations) {
  if (!locations || locations.length < 2) {
    return 0
  }

  let total = 0

  for (let i = 0; i < locations.length - 1; i++) {
    const current = locations[i]
    const next = locations[i + 1]

    if (current.latitude && current.longitude && next.latitude && next.longitude) {
      total += calculateDistance(
        current.latitude,
        current.longitude,
        next.latitude,
        next.longitude
      )
    }
  }

  return total
}
