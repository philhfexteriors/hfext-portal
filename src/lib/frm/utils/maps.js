/**
 * Google Maps integration utilities
 */

/**
 * Generate Google Maps directions URL
 * Opens in native Google Maps app on mobile, or Google Maps website on desktop
 * @param {number} destLat - Destination latitude
 * @param {number} destLon - Destination longitude
 * @param {number} [originLat] - Optional origin latitude (uses current location if not provided)
 * @param {number} [originLon] - Optional origin longitude
 * @returns {string} Google Maps directions URL
 */
export function getGoogleMapsDirectionsUrl(destLat, destLon, originLat = null, originLon = null) {
  const destination = `${destLat},${destLon}`

  if (originLat && originLon) {
    const origin = `${originLat},${originLon}`
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
  }

  // If no origin provided, Google Maps will use current location
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/**
 * Generate Google Maps place URL for a specific location
 * Opens the location in Google Maps without directions
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} [placeName] - Optional place name for the query
 * @returns {string} Google Maps place URL
 */
export function getGoogleMapsPlaceUrl(lat, lon, placeName = null) {
  if (placeName) {
    const encoded = encodeURIComponent(placeName)
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`
  }

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
}

/**
 * Generate Google Maps embed URL for iframe
 * Note: Requires a Google Maps Embed API key
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiKey - Google Maps API key
 * @returns {string} Google Maps embed URL
 */
export function getGoogleMapsEmbedUrl(lat, lon, apiKey) {
  if (!apiKey) {
    console.warn('Google Maps API key is required for embed URLs')
    return null
  }

  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lon}&zoom=15`
}

/**
 * Format address as a Google Maps search URL
 * @param {string} address - Full address string
 * @returns {string} Google Maps search URL
 */
export function getGoogleMapsAddressUrl(address) {
  const encoded = encodeURIComponent(address)
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`
}
