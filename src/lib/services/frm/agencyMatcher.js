/**
 * Agency Matcher Service
 * Finds duplicate agencies using multiple matching strategies
 */

/**
 * Calculate distance between two lat/lng points in meters (Haversine formula)
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Normalize text for comparison (lowercase, remove punctuation/whitespace)
 */
function normalizeText(text) {
  if (!text) return ''
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Normalize phone number (remove all non-digits)
 */
function normalizePhone(phone) {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Find duplicate agencies using multiple matching strategies
 * @param {Array} agencies - Array of agency objects
 * @returns {Array} Array of duplicate groups
 */
export function findDuplicateAgencies(agencies) {
  const duplicateGroups = []
  const processed = new Set()

  for (let i = 0; i < agencies.length; i++) {
    if (processed.has(i)) continue

    const group = [agencies[i]]
    const matchReasons = []

    for (let j = i + 1; j < agencies.length; j++) {
      if (processed.has(j)) continue

      const a1 = agencies[i]
      const a2 = agencies[j]
      let isMatch = false
      let reason = ''

      // Strategy 1: Exact name match (ignoring case and punctuation)
      const name1 = normalizeText(a1.name)
      const name2 = normalizeText(a2.name)

      if (name1 && name2 && name1 === name2 && name1.length > 3) {
        isMatch = true
        reason = 'Exact name match'
      }

      // Strategy 2: Same address + city (case insensitive)
      if (!isMatch && a1.address && a2.address && a1.city && a2.city) {
        const addr1 = normalizeText(a1.address)
        const addr2 = normalizeText(a2.address)
        const city1 = normalizeText(a1.city)
        const city2 = normalizeText(a2.city)

        if (addr1 === addr2 && city1 === city2 && addr1.length > 3) {
          isMatch = true
          reason = 'Same address and city'
        }
      }

      // Strategy 3: Same phone number (normalized)
      if (!isMatch && a1.phone && a2.phone) {
        const phone1 = normalizePhone(a1.phone)
        const phone2 = normalizePhone(a2.phone)

        if (phone1 === phone2 && phone1.length >= 10) {
          isMatch = true
          reason = 'Same phone number'
        }
      }

      // Strategy 4: Very close proximity (within 50 meters) with similar names
      if (!isMatch && a1.latitude && a2.latitude && a1.longitude && a2.longitude) {
        const distance = getDistanceInMeters(a1.latitude, a1.longitude, a2.latitude, a2.longitude)

        // Within 50 meters (~164 feet)
        if (distance < 50) {
          // Check if names are at least somewhat similar (simple check)
          const nameSimilarity = calculateNameSimilarity(name1, name2)
          if (nameSimilarity > 0.5) {
            isMatch = true
            reason = `Within ${Math.round(distance)}m with similar name`
          }
        }
      }

      if (isMatch) {
        group.push(a2)
        matchReasons.push(`${a2.name}: ${reason}`)
        processed.add(j)
      }
    }

    if (group.length > 1) {
      duplicateGroups.push({
        agencies: group,
        reasons: matchReasons,
        count: group.length
      })
      processed.add(i)
    }
  }

  // Sort by group size (largest first)
  return duplicateGroups.sort((a, b) => b.count - a.count)
}

/**
 * Simple name similarity calculation
 * Returns 0-1 score based on common characters
 */
function calculateNameSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  const len = Math.max(str1.length, str2.length)
  let matches = 0

  for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (str1[i] === str2[i]) matches++
  }

  return matches / len
}

/**
 * Get statistics from duplicate groups
 */
export function getDuplicateStats(duplicateGroups) {
  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.count, 0)
  const totalGroups = duplicateGroups.length
  const largestGroup = duplicateGroups.length > 0
    ? Math.max(...duplicateGroups.map(g => g.count))
    : 0

  return {
    totalGroups,
    totalDuplicates,
    largestGroup,
    avgGroupSize: totalGroups > 0 ? (totalDuplicates / totalGroups).toFixed(1) : 0
  }
}

/**
 * Suggest which agency to keep from a duplicate group
 * Prefers agencies with more complete data
 */
export function suggestKeepAgency(agencies) {
  return agencies.reduce((best, current) => {
    let bestScore = calculateCompletenessScore(best)
    let currentScore = calculateCompletenessScore(current)

    return currentScore > bestScore ? current : best
  })
}

/**
 * Calculate completeness score for an agency
 */
function calculateCompletenessScore(agency) {
  let score = 0

  // Basic fields (1 point each)
  if (agency.name) score += 1
  if (agency.address) score += 1
  if (agency.city) score += 1
  if (agency.state) score += 1
  if (agency.zip) score += 1
  if (agency.phone) score += 1

  // Geocoding (2 points - more valuable)
  if (agency.latitude && agency.longitude) score += 2

  // Website (1 point)
  if (agency.website) score += 1

  // Rating data (1 point)
  if (agency.rating) score += 1

  return score
}
