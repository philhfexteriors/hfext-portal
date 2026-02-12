/**
 * Address Validator Service
 * Validates agency addresses and flags issues for manual review
 */

/**
 * Validate an agency's address data
 * @param {Object} agency - Agency object with address fields
 * @returns {Object} Validation result with status, needsReview flag, and notes array
 */
export function validateAgencyAddress(agency) {
  const validations = {
    status: 'valid',
    needsReview: false,
    notes: []
  }

  // Check for incomplete addresses
  const missingFields = []
  if (!agency.address || agency.address.trim() === '') missingFields.push('street address')
  if (!agency.city || agency.city.trim() === '') missingFields.push('city')
  if (!agency.state || agency.state.trim() === '') missingFields.push('state')
  if (!agency.zip || agency.zip.trim() === '') missingFields.push('ZIP code')

  if (missingFields.length > 0) {
    validations.status = 'incomplete'
    validations.needsReview = true
    validations.notes.push(`Missing: ${missingFields.join(', ')}`)
  }

  // Check for suspicious patterns in address
  const suspiciousPatterns = [
    { pattern: /^(N\/A|n\/a|na|NA|none|NONE|unknown|UNKNOWN|null|NULL)$/i, reason: 'Placeholder text' },
    { pattern: /^1234/i, reason: 'Fake street number (1234)' },
    { pattern: /^test/i, reason: 'Test data' },
    { pattern: /^xxx/i, reason: 'Invalid placeholder (XXX)' },
    { pattern: /^(fake|dummy|sample)/i, reason: 'Fake/dummy data' },
  ]

  const addressToCheck = agency.address || ''
  for (const { pattern, reason } of suspiciousPatterns) {
    if (pattern.test(addressToCheck)) {
      validations.status = 'suspicious'
      validations.needsReview = true
      validations.notes.push(`Suspicious address: ${reason}`)
      break // Only report first match
    }
  }

  // Check for territory (MO/IL only)
  const validStates = ['MO', 'IL', 'Missouri', 'Illinois', 'mo', 'il', 'missouri', 'illinois']
  if (agency.state && agency.state.trim() !== '') {
    const stateNormalized = agency.state.trim()
    if (!validStates.some(s => s.toLowerCase() === stateNormalized.toLowerCase())) {
      // If incomplete, keep that status; otherwise mark as out_of_territory
      if (validations.status === 'valid') {
        validations.status = 'out_of_territory'
      }
      validations.needsReview = true
      validations.notes.push(`State "${agency.state}" is outside MO/IL territory`)
    }
  }

  // Check for missing geocoding
  if (!agency.latitude || !agency.longitude ||
      agency.latitude === 0 || agency.longitude === 0) {
    if (validations.status === 'valid') {
      validations.status = 'incomplete'
    }
    validations.needsReview = true
    validations.notes.push('Missing latitude/longitude coordinates')
  }

  // Check ZIP code format (must be 5 digits or 5+4 format)
  if (agency.zip && agency.zip.trim() !== '') {
    const zipNormalized = agency.zip.trim()
    if (!/^\d{5}(-\d{4})?$/.test(zipNormalized)) {
      if (validations.status === 'valid') {
        validations.status = 'suspicious'
      }
      validations.needsReview = true
      validations.notes.push(`Invalid ZIP code format: "${agency.zip}"`)
    }
  }

  // Check for suspicious city names
  const suspiciousCityPatterns = [
    { pattern: /^(N\/A|na|none|unknown|test|xxx)$/i, reason: 'Placeholder city name' },
  ]

  const cityToCheck = agency.city || ''
  for (const { pattern, reason } of suspiciousCityPatterns) {
    if (pattern.test(cityToCheck)) {
      if (validations.status === 'valid') {
        validations.status = 'suspicious'
      }
      validations.needsReview = true
      validations.notes.push(reason)
      break
    }
  }

  return validations
}

/**
 * Batch validate multiple agencies
 * @param {Array} agencies - Array of agency objects
 * @returns {Array} Array of validation results with agency IDs
 */
export function batchValidateAgencies(agencies) {
  return agencies.map(agency => ({
    id: agency.id,
    validation: validateAgencyAddress(agency)
  }))
}

/**
 * Get statistics from validation results
 * @param {Array} validationResults - Array of validation results
 * @returns {Object} Statistics object
 */
export function getValidationStats(validationResults) {
  const stats = {
    total: validationResults.length,
    valid: 0,
    incomplete: 0,
    out_of_territory: 0,
    suspicious: 0,
    unvalidated: 0,
    needs_review: 0
  }

  validationResults.forEach(result => {
    const status = result.validation?.status || 'unvalidated'
    stats[status] = (stats[status] || 0) + 1

    if (result.validation?.needsReview) {
      stats.needs_review++
    }
  })

  return stats
}
