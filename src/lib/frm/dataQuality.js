// Data Quality Utility Functions
// Centralized logic for checking data completeness

/**
 * Check if agency has complete address data (city, state, zip)
 * @param {Object} agency - Agency object
 * @returns {Object} { complete: boolean, missing: string[] }
 */
export function isAgencyComplete(agency) {
  const missing = []
  if (!agency.city) missing.push('city')
  if (!agency.state) missing.push('state')
  if (!agency.zip) missing.push('zip')

  return {
    complete: missing.length === 0,
    missing: missing
  }
}

/**
 * Check if contact has BOTH email AND phone
 * @param {Object} contact - Contact object
 * @returns {Object} { complete: boolean, missing: string[] }
 */
export function isContactComplete(contact) {
  const missing = []
  if (!contact.email) missing.push('email')
  if (!contact.phone) missing.push('phone')

  return {
    complete: missing.length === 0,
    missing: missing
  }
}

/**
 * Get comprehensive quality status for agency + contacts
 * @param {Object} agency - Agency object
 * @param {Array} contacts - Array of contact objects
 * @returns {Object} Quality status with detailed breakdown
 */
export function getAgencyQualityStatus(agency, contacts = []) {
  const agencyQuality = isAgencyComplete(agency)
  const incompleteContacts = contacts.filter(c => !isContactComplete(c).complete)

  return {
    agencyComplete: agencyQuality.complete,
    agencyMissing: agencyQuality.missing,
    contactStats: {
      total: contacts.length,
      complete: contacts.length - incompleteContacts.length,
      incomplete: incompleteContacts.length
    },
    incompleteContacts: incompleteContacts
  }
}

/**
 * Format missing fields for human-readable display
 * @param {Array} missing - Array of missing field names
 * @returns {string} Comma-separated capitalized field names
 */
export function formatMissingFields(missing) {
  return missing.map(field => {
    return field.charAt(0).toUpperCase() + field.slice(1)
  }).join(', ')
}

/**
 * Calculate overall data quality statistics
 * @param {Array} agencies - Array of all agencies
 * @param {Array} contacts - Array of all contacts
 * @returns {Object} Statistics for agencies and contacts
 */
export function calculateQualityStats(agencies, contacts) {
  const incompleteAgencies = agencies.filter(a => !isAgencyComplete(a).complete)
  const incompleteContacts = contacts.filter(c => !isContactComplete(c).complete)

  const agenciesTotal = agencies.length || 1 // Avoid division by zero
  const contactsTotal = contacts.length || 1

  return {
    agencies: {
      total: agencies.length,
      complete: agencies.length - incompleteAgencies.length,
      incomplete: incompleteAgencies.length,
      percentComplete: ((agencies.length - incompleteAgencies.length) / agenciesTotal * 100).toFixed(1)
    },
    contacts: {
      total: contacts.length,
      complete: contacts.length - incompleteContacts.length,
      incomplete: incompleteContacts.length,
      percentComplete: ((contacts.length - incompleteContacts.length) / contactsTotal * 100).toFixed(1)
    }
  }
}
