/**
 * Google Distance Matrix API Service with Supabase Caching
 *
 * Wraps Google's Distance Matrix API with a cache-first approach:
 * 1. Check drive_time_cache for existing pairs
 * 2. Only fetch missing pairs from Google
 * 3. Save new results to cache
 *
 * Pricing: $5/1000 elements (basic). 17x17 = 289 elements per day-group.
 * ~66 day-groups = ~19,000 elements = ~$0.10 per full optimization run.
 */

const GOOGLE_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const MAX_ORIGINS = 25
const MAX_DESTINATIONS = 25
const REQUEST_DELAY_MS = 200 // Safety margin for rate limiting

/**
 * Delay helper for rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Call Google Distance Matrix API for a batch of origins/destinations.
 * Google limits: 25 origins, 25 destinations, 100 elements per request.
 *
 * @param {Array<{lat: number, lng: number}>} origins
 * @param {Array<{lat: number, lng: number}>} destinations
 * @param {string} apiKey
 * @returns {Array<Array<{durationSeconds: number, distanceMeters: number}>>}
 */
async function fetchDistanceMatrixBatch(origins, destinations, apiKey) {
  const originStr = origins.map(o => `${o.lat},${o.lng}`).join('|')
  const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|')

  const url = `${GOOGLE_DISTANCE_MATRIX_URL}?origins=${encodeURIComponent(originStr)}&destinations=${encodeURIComponent(destStr)}&mode=driving&key=${apiKey}`

  const response = await fetch(url)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Distance Matrix API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix API returned status: ${data.status}`)
  }

  // Parse results into a 2D array
  const results = []
  for (let i = 0; i < data.rows.length; i++) {
    const row = []
    for (let j = 0; j < data.rows[i].elements.length; j++) {
      const element = data.rows[i].elements[j]
      if (element.status === 'OK') {
        row.push({
          durationSeconds: element.duration.value,
          distanceMeters: element.distance.value
        })
      } else {
        // Fallback: use a large value so this pair is deprioritized but doesn't break
        row.push({
          durationSeconds: 9999,
          distanceMeters: 999999
        })
      }
    }
    results.push(row)
  }

  return results
}

/**
 * Fetch drive times for a set of agencies, using cache first.
 * Returns a Map keyed by "originId->destId" with {durationSeconds, distanceMeters}.
 *
 * @param {Array<{id: string, latitude: number, longitude: number}>} agencies
 * @param {object} supabase - Supabase client
 * @param {string} apiKey - Google API key
 * @returns {Map<string, {durationSeconds: number, distanceMeters: number}>}
 */
export async function getOrFetchDriveTimes(agencies, supabase, apiKey) {
  const agencyIds = agencies.map(a => a.id)
  const driveTimeMap = new Map()

  // Step 1: Check cache for existing pairs
  const { data: cached, error: cacheError } = await supabase
    .from('drive_time_cache')
    .select('origin_agency_id, destination_agency_id, drive_time_seconds, distance_meters')
    .in('origin_agency_id', agencyIds)
    .in('destination_agency_id', agencyIds)

  if (cacheError) {
    console.error('Cache read error:', cacheError)
    // Continue without cache
  }

  // Build set of cached pairs
  const cachedPairs = new Set()
  if (cached) {
    for (const row of cached) {
      const key = `${row.origin_agency_id}->${row.destination_agency_id}`
      driveTimeMap.set(key, {
        durationSeconds: row.drive_time_seconds,
        distanceMeters: row.distance_meters
      })
      cachedPairs.add(key)
    }
  }

  // Step 2: Identify missing pairs
  const missingPairs = []
  for (const origin of agencies) {
    for (const dest of agencies) {
      if (origin.id === dest.id) continue
      const key = `${origin.id}->${dest.id}`
      if (!cachedPairs.has(key)) {
        missingPairs.push({ origin, dest })
      }
    }
  }

  if (missingPairs.length === 0) {
    console.log(`All ${cachedPairs.size} drive time pairs found in cache`)
    return driveTimeMap
  }

  console.log(`Cache hit: ${cachedPairs.size} pairs. Fetching ${missingPairs.length} missing pairs from Google...`)

  // Step 3: Fetch missing pairs from Google in batches
  // We need to be smart about batching - fetch the full NxN for missing agencies
  // rather than individual pairs, since the API charges per element either way
  const missingOriginIds = new Set(missingPairs.map(p => p.origin.id))
  const missingDestIds = new Set(missingPairs.map(p => p.dest.id))

  // Get unique agencies that need fetching
  const originsToFetch = agencies.filter(a => missingOriginIds.has(a.id))
  const destsToFetch = agencies.filter(a => missingDestIds.has(a.id))

  // For simplicity with small groups (17 agencies), just fetch the full matrix
  // This is more efficient than trying to fetch only specific missing pairs
  if (agencies.length <= MAX_ORIGINS) {
    // Single batch - fetch full NxN
    const origins = agencies.map(a => ({
      lat: parseFloat(a.latitude),
      lng: parseFloat(a.longitude)
    }))
    const destinations = [...origins] // Same set for NxN

    try {
      const results = await fetchDistanceMatrixBatch(origins, destinations, apiKey)

      // Store results and cache them
      const cacheInserts = []

      for (let i = 0; i < agencies.length; i++) {
        for (let j = 0; j < agencies.length; j++) {
          if (i === j) continue
          const key = `${agencies[i].id}->${agencies[j].id}`
          if (!cachedPairs.has(key)) {
            driveTimeMap.set(key, results[i][j])
            cacheInserts.push({
              origin_agency_id: agencies[i].id,
              destination_agency_id: agencies[j].id,
              drive_time_seconds: results[i][j].durationSeconds,
              distance_meters: results[i][j].distanceMeters
            })
          }
        }
      }

      // Save to cache (upsert to handle race conditions)
      if (cacheInserts.length > 0) {
        const CHUNK_SIZE = 500
        for (let c = 0; c < cacheInserts.length; c += CHUNK_SIZE) {
          const chunk = cacheInserts.slice(c, c + CHUNK_SIZE)
          const { error: insertError } = await supabase
            .from('drive_time_cache')
            .upsert(chunk, { onConflict: 'origin_agency_id,destination_agency_id' })

          if (insertError) {
            console.error('Cache write error:', insertError)
            // Non-fatal - we still have the data in memory
          }
        }
        console.log(`Cached ${cacheInserts.length} new drive time pairs`)
      }
    } catch (fetchError) {
      console.error('Google API fetch error:', fetchError)
      // Return what we have from cache - caller should handle incomplete data
    }
  } else {
    // For larger sets, batch into 25x25 chunks
    for (let oi = 0; oi < agencies.length; oi += MAX_ORIGINS) {
      const originBatch = agencies.slice(oi, oi + MAX_ORIGINS)

      for (let di = 0; di < agencies.length; di += MAX_DESTINATIONS) {
        const destBatch = agencies.slice(di, di + MAX_DESTINATIONS)

        // Check if any pairs in this chunk are missing
        let hasMissing = false
        for (const o of originBatch) {
          for (const d of destBatch) {
            if (o.id !== d.id && !cachedPairs.has(`${o.id}->${d.id}`)) {
              hasMissing = true
              break
            }
          }
          if (hasMissing) break
        }

        if (!hasMissing) continue

        try {
          const origins = originBatch.map(a => ({
            lat: parseFloat(a.latitude),
            lng: parseFloat(a.longitude)
          }))
          const destinations = destBatch.map(a => ({
            lat: parseFloat(a.latitude),
            lng: parseFloat(a.longitude)
          }))

          const results = await fetchDistanceMatrixBatch(origins, destinations, apiKey)
          const cacheInserts = []

          for (let i = 0; i < originBatch.length; i++) {
            for (let j = 0; j < destBatch.length; j++) {
              if (originBatch[i].id === destBatch[j].id) continue
              const key = `${originBatch[i].id}->${destBatch[j].id}`
              if (!cachedPairs.has(key)) {
                driveTimeMap.set(key, results[i][j])
                cacheInserts.push({
                  origin_agency_id: originBatch[i].id,
                  destination_agency_id: destBatch[j].id,
                  drive_time_seconds: results[i][j].durationSeconds,
                  distance_meters: results[i][j].distanceMeters
                })
              }
            }
          }

          if (cacheInserts.length > 0) {
            const { error: insertError } = await supabase
              .from('drive_time_cache')
              .upsert(cacheInserts, { onConflict: 'origin_agency_id,destination_agency_id' })

            if (insertError) {
              console.error('Cache write error:', insertError)
            }
          }

          await delay(REQUEST_DELAY_MS)
        } catch (fetchError) {
          console.error('Batch fetch error:', fetchError)
          // Continue with next batch
        }
      }
    }
  }

  return driveTimeMap
}

/**
 * Build an NxN drive time matrix for a group of agencies.
 * Returns a 2D array where matrix[i][j] = drive time in seconds from agency i to agency j.
 * matrix[i][i] = 0 (self-distance).
 *
 * @param {Array<{id: string, latitude: number, longitude: number}>} agencies
 * @param {object} supabase
 * @param {string} apiKey
 * @returns {{matrix: number[][], agencies: Array, totalApiCalls: number}}
 */
export async function buildDriveTimeMatrix(agencies, supabase, apiKey) {
  const driveTimeMap = await getOrFetchDriveTimes(agencies, supabase, apiKey)

  const n = agencies.length
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

  let hasFallback = false

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue

      const key = `${agencies[i].id}->${agencies[j].id}`
      const data = driveTimeMap.get(key)

      if (data) {
        matrix[i][j] = data.durationSeconds
      } else {
        // Fallback to Haversine estimate (assume 30mph average in metro area)
        hasFallback = true
        const dist = haversineDistance(
          parseFloat(agencies[i].latitude),
          parseFloat(agencies[i].longitude),
          parseFloat(agencies[j].latitude),
          parseFloat(agencies[j].longitude)
        )
        matrix[i][j] = Math.round((dist / 30) * 3600) // miles / mph * seconds/hour
      }
    }
  }

  if (hasFallback) {
    console.warn('Some drive times fell back to Haversine estimates')
  }

  return { matrix, agencies }
}

/**
 * Haversine formula (duplicated here to avoid circular imports)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
