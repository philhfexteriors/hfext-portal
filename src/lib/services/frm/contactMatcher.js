/**
 * Contact Matcher Service
 * Finds duplicate contacts using fuzzy matching (Levenshtein distance)
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of edits (insertions, deletions, substitutions) needed
 */
function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0)

  const matrix = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1

  const distance = levenshtein(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)
  return 1 - distance / maxLength
}

/**
 * Normalize phone number (remove all non-digits)
 */
function normalizePhone(phone) {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Find duplicate contacts within same agency
 * @param {Array} contacts - Array of contact objects
 * @returns {Array} Array of duplicate groups
 */
export function findDuplicateContacts(contacts) {
  const duplicateGroups = []
  const processed = new Set()

  for (let i = 0; i < contacts.length; i++) {
    if (processed.has(i)) continue

    const group = [contacts[i]]
    const matchReasons = []

    for (let j = i + 1; j < contacts.length; j++) {
      if (processed.has(j)) continue

      const c1 = contacts[i]
      const c2 = contacts[j]
      let isMatch = false
      let reason = ''

      // Strategy 1: Exact email match (case insensitive)
      if (c1.email && c2.email) {
        if (c1.email.toLowerCase() === c2.email.toLowerCase()) {
          isMatch = true
          reason = 'Same email address'
        }
      }

      // Strategy 2: Exact phone match (normalized)
      if (!isMatch && c1.phone && c2.phone) {
        const phone1 = normalizePhone(c1.phone)
        const phone2 = normalizePhone(c2.phone)

        if (phone1 === phone2 && phone1.length >= 10) {
          isMatch = true
          reason = 'Same phone number'
        }
      }

      // Strategy 3: Fuzzy name matching (80% similarity threshold)
      if (!isMatch && c1.name && c2.name) {
        const nameSimilarity = similarity(c1.name, c2.name)
        if (nameSimilarity >= 0.8) {
          isMatch = true
          reason = `Very similar name (${Math.round(nameSimilarity * 100)}% match)`
        }
      }

      // Strategy 4: Partial name + same email domain
      if (!isMatch && c1.name && c2.name && c1.email && c2.email) {
        const domain1 = c1.email.split('@')[1]?.toLowerCase()
        const domain2 = c2.email.split('@')[1]?.toLowerCase()

        if (domain1 && domain2 && domain1 === domain2) {
          // Check if one name is contained in the other (e.g., "John" and "John Smith")
          const name1Lower = c1.name.toLowerCase()
          const name2Lower = c2.name.toLowerCase()

          if (name1Lower.includes(name2Lower) || name2Lower.includes(name1Lower)) {
            isMatch = true
            reason = 'Partial name match with same email domain'
          }
        }
      }

      if (isMatch) {
        group.push(c2)
        matchReasons.push(`${c2.name}: ${reason}`)
        processed.add(j)
      }
    }

    if (group.length > 1) {
      duplicateGroups.push({
        contacts: group,
        reasons: matchReasons,
        count: group.length
      })
      processed.add(i)
    }
  }

  return duplicateGroups
}

/**
 * Find agencies with duplicate contacts
 * @param {Array} agencies - Array of agency objects with contacts
 * @returns {Array} Array of agencies with duplicates
 */
export function findAgenciesWithDuplicates(agencies) {
  return agencies
    .filter(agency => agency.agency_contacts && agency.agency_contacts.length >= 2)
    .map(agency => {
      const duplicates = findDuplicateContacts(agency.agency_contacts)
      return {
        ...agency,
        duplicateGroups: duplicates,
        totalDuplicates: duplicates.reduce((sum, group) => sum + group.count, 0)
      }
    })
    .filter(agency => agency.duplicateGroups.length > 0)
}

/**
 * Get statistics from agencies with duplicates
 */
export function getDuplicateStats(agenciesWithDuplicates) {
  const totalAgenciesAffected = agenciesWithDuplicates.length
  const totalDuplicateGroups = agenciesWithDuplicates.reduce(
    (sum, agency) => sum + agency.duplicateGroups.length,
    0
  )
  const totalDuplicateContacts = agenciesWithDuplicates.reduce(
    (sum, agency) => sum + agency.totalDuplicates,
    0
  )

  return {
    totalAgenciesAffected,
    totalDuplicateGroups,
    totalDuplicateContacts,
    avgDuplicatesPerAgency: totalAgenciesAffected > 0
      ? (totalDuplicateContacts / totalAgenciesAffected).toFixed(1)
      : 0
  }
}

/**
 * Suggest which contact to keep from a duplicate group
 * Prefers contacts with more complete data
 */
export function suggestKeepContact(contacts) {
  return contacts.reduce((best, current) => {
    let bestScore = calculateCompletenessScore(best)
    let currentScore = calculateCompletenessScore(current)

    return currentScore > bestScore ? current : best
  })
}

/**
 * Calculate completeness score for a contact
 */
function calculateCompletenessScore(contact) {
  let score = 0

  // Basic fields (1 point each)
  if (contact.name) score += 1
  if (contact.email) score += 2 // Email is more valuable
  if (contact.phone) score += 2 // Phone is more valuable
  if (contact.title) score += 1

  return score
}
