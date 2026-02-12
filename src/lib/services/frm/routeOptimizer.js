/**
 * Route Optimizer - Balanced K-Means + City Coherence + Drive-Time TSP
 *
 * Design:
 * - 11 geographic zones with roughly equal agency counts
 * - 17 agencies per day, 85 per week (FRM bonus threshold)
 * - Agencies grouped by geographic proximity using K-Means
 * - City coherence refinement keeps same-city agencies together
 * - Outlier detection removes geographic anomalies from zones
 * - Drive-time TSP with 2-opt optimizes daily visit order using real Google data
 * - Schedule cycles through all agencies, however many weeks that takes
 *
 * Algorithm:
 * 1. Run K-Means to find optimal zone centroids
 * 2. Use balanced greedy assignment to distribute agencies evenly
 * 3. Refine zones for city coherence (swap agencies to keep cities together)
 * 4. Remove outliers (reassign agencies far from their zone centroid)
 * 5. Within each zone, sort by nearest-neighbor proximity
 * 6. Build daily schedules of 17 per day
 * 7. Re-optimize each daily route using Google drive times + 2-opt
 */

import { buildDriveTimeMatrix } from './distanceMatrixService'

/**
 * Haversine formula to calculate distance between two lat/lng points in miles
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Initialize K-Means centroids using K-Means++ for better starting positions.
 * Picks first centroid randomly, then picks subsequent centroids with probability
 * proportional to squared distance from nearest existing centroid.
 */
function initCentroidsKMeansPlusPlus(points, k) {
  const centroids = []

  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * points.length)
  centroids.push([...points[firstIdx]])

  for (let c = 1; c < k; c++) {
    // Compute distance from each point to nearest existing centroid
    const distances = points.map(p => {
      let minDist = Infinity
      for (const centroid of centroids) {
        const d = haversineDistance(p[0], p[1], centroid[0], centroid[1])
        if (d < minDist) minDist = d
      }
      return minDist * minDist // squared distance
    })

    // Pick next centroid with probability proportional to squared distance
    const totalDist = distances.reduce((s, d) => s + d, 0)
    let r = Math.random() * totalDist
    let nextIdx = 0
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i]
      if (r <= 0) {
        nextIdx = i
        break
      }
    }
    centroids.push([...points[nextIdx]])
  }

  return centroids
}

/**
 * Run standard K-Means to find good centroids.
 * We only care about the final centroids, not the assignments.
 */
function findCentroids(agencies, numZones, maxIterations = 50) {
  const points = agencies.map(a => [parseFloat(a.latitude), parseFloat(a.longitude)])

  let centroids = initCentroidsKMeansPlusPlus(points, numZones)

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const clusters = Array.from({ length: numZones }, () => [])

    for (const point of points) {
      let minDist = Infinity
      let bestCluster = 0
      for (let c = 0; c < centroids.length; c++) {
        const d = haversineDistance(point[0], point[1], centroids[c][0], centroids[c][1])
        if (d < minDist) {
          minDist = d
          bestCluster = c
        }
      }
      clusters[bestCluster].push(point)
    }

    // Recompute centroids
    let converged = true
    const newCentroids = centroids.map((oldCentroid, c) => {
      if (clusters[c].length === 0) return oldCentroid

      const avgLat = clusters[c].reduce((s, p) => s + p[0], 0) / clusters[c].length
      const avgLng = clusters[c].reduce((s, p) => s + p[1], 0) / clusters[c].length

      // Check convergence (centroid moved less than ~0.01 miles)
      if (haversineDistance(oldCentroid[0], oldCentroid[1], avgLat, avgLng) > 0.01) {
        converged = false
      }

      return [avgLat, avgLng]
    })

    centroids = newCentroids
    if (converged) {
      console.log(`K-Means converged after ${iter + 1} iterations`)
      break
    }
  }

  return centroids
}

/**
 * Balanced assignment: distribute agencies to zones evenly based on proximity.
 *
 * 1. Compute distance from every agency to every centroid
 * 2. Sort all (agency, centroid) pairs by distance
 * 3. Greedily assign: pick shortest distance pair, assign if zone not full
 * 4. Result: zones are roughly equal size AND geographically coherent
 */
function balancedAssignment(agencies, centroids, numZones) {
  const maxPerZone = Math.ceil(agencies.length / numZones)

  // Compute all distances
  const pairs = []
  for (let i = 0; i < agencies.length; i++) {
    const lat = parseFloat(agencies[i].latitude)
    const lng = parseFloat(agencies[i].longitude)
    for (let c = 0; c < centroids.length; c++) {
      pairs.push({
        agencyIdx: i,
        clusterIdx: c,
        distance: haversineDistance(lat, lng, centroids[c][0], centroids[c][1])
      })
    }
  }

  // Sort by distance (closest first)
  pairs.sort((a, b) => a.distance - b.distance)

  // Greedy assignment with capacity constraints
  const assignments = new Array(agencies.length).fill(-1)
  const clusterSizes = new Array(numZones).fill(0)
  let assigned = 0

  for (const pair of pairs) {
    if (assigned >= agencies.length) break
    if (assignments[pair.agencyIdx] !== -1) continue // already assigned
    if (clusterSizes[pair.clusterIdx] >= maxPerZone) continue // zone full

    assignments[pair.agencyIdx] = pair.clusterIdx
    clusterSizes[pair.clusterIdx]++
    assigned++
  }

  // Group agencies by cluster
  const chunks = Array.from({ length: numZones }, () => [])
  for (let i = 0; i < agencies.length; i++) {
    if (assignments[i] >= 0) {
      chunks[assignments[i]].push(agencies[i])
    }
  }

  return chunks
}

// ============================================================
// NEW: City Coherence Refinement
// ============================================================

/**
 * Compute centroid of a set of agencies
 */
function computeCentroid(agencies) {
  if (agencies.length === 0) return [0, 0]
  const lat = agencies.reduce((s, a) => s + parseFloat(a.latitude), 0) / agencies.length
  const lng = agencies.reduce((s, a) => s + parseFloat(a.longitude), 0) / agencies.length
  return [lat, lng]
}

/**
 * Refine zone assignments to keep cities together.
 *
 * For each agency, if more than half the agencies in its city are in a different
 * zone, attempt to swap it with an agency in that zone that's near this zone's
 * centroid. Only swaps if both zones stay within balance and total distance
 * doesn't increase.
 *
 * Max 3 iterations to prevent infinite loops.
 */
function refineCityCoherence(chunks, numZones) {
  const maxPerZone = Math.ceil(
    chunks.reduce((sum, c) => sum + c.length, 0) / numZones
  )
  const minPerZone = Math.floor(
    chunks.reduce((sum, c) => sum + c.length, 0) / numZones
  ) - 1 // Allow slight under-fill

  let totalSwaps = 0

  for (let iteration = 0; iteration < 3; iteration++) {
    let swapsThisRound = 0

    // Build city-to-zone mapping
    const cityZoneMap = {} // city -> { zoneIdx: count }
    for (let z = 0; z < chunks.length; z++) {
      for (const agency of chunks[z]) {
        const city = (agency.city || '').trim().toLowerCase()
        if (!city) continue
        if (!cityZoneMap[city]) cityZoneMap[city] = {}
        cityZoneMap[city][z] = (cityZoneMap[city][z] || 0) + 1
      }
    }

    // For each zone, check each agency
    for (let z = 0; z < chunks.length; z++) {
      const zoneCentroid = computeCentroid(chunks[z])

      for (let aIdx = 0; aIdx < chunks[z].length; aIdx++) {
        const agency = chunks[z][aIdx]
        const city = (agency.city || '').trim().toLowerCase()
        if (!city) continue

        const cityDistribution = cityZoneMap[city]
        if (!cityDistribution) continue

        // Find which zone has the most agencies from this city
        let bestZone = z
        let bestCount = cityDistribution[z] || 0
        for (const [zoneStr, count] of Object.entries(cityDistribution)) {
          const zoneIdx = parseInt(zoneStr)
          if (count > bestCount) {
            bestCount = count
            bestZone = zoneIdx
          }
        }

        // If this agency is already in the dominant zone for its city, skip
        if (bestZone === z) continue

        // Check if more than half are in the other zone
        const totalInCity = Object.values(cityDistribution).reduce((s, c) => s + c, 0)
        if (bestCount <= totalInCity / 2) continue

        // Try to swap: find an agency in bestZone that's close to z's centroid
        // and whose city is NOT dominant in bestZone
        const targetZone = chunks[bestZone]
        const targetCentroid = computeCentroid(targetZone)

        let bestSwapIdx = -1
        let bestSwapScore = Infinity

        for (let sIdx = 0; sIdx < targetZone.length; sIdx++) {
          const swapCandidate = targetZone[sIdx]
          const swapCity = (swapCandidate.city || '').trim().toLowerCase()

          // Don't swap an agency that's in its dominant zone
          const swapCityDist = cityZoneMap[swapCity]
          if (swapCityDist) {
            const swapCityBestZone = Object.entries(swapCityDist)
              .sort((a, b) => b[1] - a[1])[0]
            if (parseInt(swapCityBestZone[0]) === bestZone) continue
          }

          // Score: how close is this candidate to zone z's centroid?
          const score = haversineDistance(
            parseFloat(swapCandidate.latitude),
            parseFloat(swapCandidate.longitude),
            zoneCentroid[0],
            zoneCentroid[1]
          )

          if (score < bestSwapScore) {
            bestSwapScore = score
            bestSwapIdx = sIdx
          }
        }

        if (bestSwapIdx === -1) continue

        // Verify balance constraints
        if (chunks[z].length - 1 < minPerZone) continue
        if (targetZone.length - 1 < minPerZone) continue

        // Perform swap
        const swappedAgency = targetZone[bestSwapIdx]

        // Update city-zone map
        cityZoneMap[city][z] = (cityZoneMap[city][z] || 0) - 1
        cityZoneMap[city][bestZone] = (cityZoneMap[city][bestZone] || 0) + 1

        const swapCity = (swappedAgency.city || '').trim().toLowerCase()
        if (swapCity && cityZoneMap[swapCity]) {
          cityZoneMap[swapCity][bestZone] = (cityZoneMap[swapCity][bestZone] || 0) - 1
          cityZoneMap[swapCity][z] = (cityZoneMap[swapCity][z] || 0) + 1
        }

        // Do the swap
        chunks[z][aIdx] = swappedAgency
        targetZone[bestSwapIdx] = agency
        swapsThisRound++
      }
    }

    totalSwaps += swapsThisRound
    console.log(`City coherence iteration ${iteration + 1}: ${swapsThisRound} swaps`)

    if (swapsThisRound === 0) break
  }

  console.log(`City coherence refinement: ${totalSwaps} total swaps`)
  return chunks
}

// ============================================================
// NEW: Outlier Removal
// ============================================================

/**
 * Find and reassign geographic outliers.
 *
 * For each zone, compute the median distance of all agencies to the zone centroid.
 * Agencies more than 2.5x the median are flagged as outliers and reassigned to
 * the nearest zone that has capacity, if it reduces their distance by >30%.
 */
function removeOutliers(chunks, numZones) {
  const maxPerZone = Math.ceil(
    chunks.reduce((sum, c) => sum + c.length, 0) / numZones
  ) + 2 // Slight buffer for receiving outliers

  let outliersMoved = 0

  for (let z = 0; z < chunks.length; z++) {
    if (chunks[z].length === 0) continue

    const centroid = computeCentroid(chunks[z])

    // Compute distances to centroid
    const distances = chunks[z].map(a =>
      haversineDistance(parseFloat(a.latitude), parseFloat(a.longitude), centroid[0], centroid[1])
    )

    // Find median distance
    const sorted = [...distances].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    // Threshold: 2.5x median
    const threshold = median * 2.5

    // Flag outliers (iterate backwards to safely remove)
    for (let aIdx = chunks[z].length - 1; aIdx >= 0; aIdx--) {
      if (distances[aIdx] <= threshold) continue

      const agency = chunks[z][aIdx]

      // Find best alternative zone
      let bestAlternativeZone = -1
      let bestAlternativeDist = distances[aIdx]

      for (let oz = 0; oz < chunks.length; oz++) {
        if (oz === z) continue
        if (chunks[oz].length >= maxPerZone) continue

        const otherCentroid = computeCentroid(chunks[oz])
        const dist = haversineDistance(
          parseFloat(agency.latitude),
          parseFloat(agency.longitude),
          otherCentroid[0],
          otherCentroid[1]
        )

        // Only move if it reduces distance by >30%
        if (dist < bestAlternativeDist * 0.7) {
          bestAlternativeDist = dist
          bestAlternativeZone = oz
        }
      }

      if (bestAlternativeZone >= 0) {
        // Move agency to better zone
        chunks[z].splice(aIdx, 1)
        chunks[bestAlternativeZone].push(agency)
        outliersMoved++
      }
    }
  }

  console.log(`Outlier removal: ${outliersMoved} agencies reassigned`)
  return chunks
}

// ============================================================
// NEW: Drive-Time TSP with 2-opt
// ============================================================

/**
 * Nearest-neighbor TSP using a drive time matrix.
 * Returns indices in visit order.
 *
 * @param {number[][]} matrix - NxN drive time matrix (seconds)
 * @returns {number[]} - indices in visit order
 */
function nearestNeighborTSP(matrix) {
  const n = matrix.length
  if (n <= 1) return [0]

  const visited = new Array(n).fill(false)
  const order = []

  // Start from index 0 (we'll pick the best starting point later via 2-opt)
  let current = 0
  visited[current] = true
  order.push(current)

  while (order.length < n) {
    let nearest = -1
    let nearestTime = Infinity

    for (let j = 0; j < n; j++) {
      if (visited[j]) continue
      if (matrix[current][j] < nearestTime) {
        nearestTime = matrix[current][j]
        nearest = j
      }
    }

    if (nearest === -1) break
    visited[nearest] = true
    order.push(nearest)
    current = nearest
  }

  return order
}

/**
 * 2-opt improvement: try swapping pairs of edges to reduce total route time.
 * Repeats until no more improvements found (typically 2-3 iterations for n=17).
 *
 * @param {number[]} route - indices in current visit order
 * @param {number[][]} matrix - NxN drive time matrix
 * @returns {number[]} - improved route
 */
function twoOpt(route, matrix) {
  const n = route.length
  if (n <= 3) return route

  let improved = true
  let bestRoute = [...route]

  while (improved) {
    improved = false

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        // Calculate current cost of edges (i, i+1) and (j, j+1 or end)
        const a = bestRoute[i]
        const b = bestRoute[i + 1]
        const c = bestRoute[j]
        const d = j + 1 < n ? bestRoute[j + 1] : null

        const currentCost = matrix[a][b] + (d !== null ? matrix[c][d] : 0)
        const newCost = matrix[a][c] + (d !== null ? matrix[b][d] : 0)

        if (newCost < currentCost - 1) { // 1-second threshold to avoid floating point issues
          // Reverse the segment between i+1 and j
          const newRoute = [...bestRoute]
          let left = i + 1
          let right = j
          while (left < right) {
            const temp = newRoute[left]
            newRoute[left] = newRoute[right]
            newRoute[right] = temp
            left++
            right--
          }
          bestRoute = newRoute
          improved = true
        }
      }
    }
  }

  return bestRoute
}

/**
 * Calculate total route time for a given order.
 *
 * @param {number[]} route - indices in visit order
 * @param {number[][]} matrix - NxN drive time matrix
 * @returns {number} - total time in seconds
 */
function routeTime(route, matrix) {
  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]]
  }
  return total
}

/**
 * Optimize daily route using drive time matrix + 2-opt.
 * Falls back to Haversine nearest-neighbor if no drive times available.
 *
 * @param {Array} dayAgencies - array of agency objects for one day
 * @param {object|null} supabase - Supabase client (null to skip drive times)
 * @param {string|null} apiKey - Google API key (null to skip drive times)
 * @returns {{agencies: Array, estimatedDriveMinutes: number|null, estimatedDistanceMiles: number|null}}
 */
async function optimizeDailyRoute(dayAgencies, supabase, apiKey) {
  if (dayAgencies.length <= 2) {
    return {
      agencies: dayAgencies,
      estimatedDriveMinutes: null,
      estimatedDistanceMiles: null
    }
  }

  // If we have supabase + API key, use real drive times
  if (supabase && apiKey) {
    try {
      const { matrix, agencies: matrixAgencies } = await buildDriveTimeMatrix(dayAgencies, supabase, apiKey)

      // Run nearest-neighbor + 2-opt
      const nnOrder = nearestNeighborTSP(matrix)
      const optimizedOrder = twoOpt(nnOrder, matrix)

      // Reorder agencies
      const reorderedAgencies = optimizedOrder.map((idx, seq) => ({
        ...matrixAgencies[idx],
        sequenceOrder: seq + 1
      }))

      // Calculate total drive time and distance
      const totalSeconds = routeTime(optimizedOrder, matrix)
      const estimatedDriveMinutes = Math.round(totalSeconds / 60 * 10) / 10

      // Estimate distance from drive time (rough: assume avg 25mph in metro)
      const estimatedDistanceMiles = Math.round(totalSeconds / 3600 * 25 * 10) / 10

      return {
        agencies: reorderedAgencies,
        estimatedDriveMinutes,
        estimatedDistanceMiles
      }
    } catch (error) {
      console.error('Drive time optimization failed, falling back to Haversine:', error)
      // Fall through to Haversine fallback below
    }
  }

  // Fallback: Haversine-based ordering (current behavior)
  return {
    agencies: dayAgencies,
    estimatedDriveMinutes: null,
    estimatedDistanceMiles: null
  }
}

/**
 * Sort agencies within a zone using nearest neighbor TSP approximation (Haversine)
 * Used as initial ordering before daily groups are formed.
 */
function sortAgenciesByProximity(agencies) {
  if (agencies.length <= 1) return agencies

  const sorted = []
  const remaining = [...agencies]

  // Start with southernmost/westernmost point
  let current = remaining.reduce((min, agency) => {
    const minVal = parseFloat(min.latitude) + parseFloat(min.longitude)
    const curVal = parseFloat(agency.latitude) + parseFloat(agency.longitude)
    return curVal < minVal ? agency : min
  })

  sorted.push(current)
  remaining.splice(remaining.indexOf(current), 1)

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineDistance(
        parseFloat(current.latitude),
        parseFloat(current.longitude),
        parseFloat(remaining[i].latitude),
        parseFloat(remaining[i].longitude)
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }

    current = remaining[nearestIndex]
    sorted.push(current)
    remaining.splice(nearestIndex, 1)
  }

  return sorted
}

/**
 * Assign sorted agencies to daily schedules within a zone
 * Returns array of { dayOfWeek, weekNumber, agencies[] }
 */
function buildDailySchedule(sortedAgencies, agenciesPerDay = 17) {
  const days = []
  let agencyIndex = 0
  let weekNumber = 1
  let dayOfWeek = 1

  while (agencyIndex < sortedAgencies.length) {
    const dayAgencies = sortedAgencies.slice(agencyIndex, agencyIndex + agenciesPerDay)

    days.push({
      dayOfWeek,
      weekNumber,
      agencies: dayAgencies.map((agency, seq) => ({
        ...agency,
        sequenceOrder: seq + 1,
        weekNumber
      }))
    })

    agencyIndex += dayAgencies.length

    dayOfWeek++
    if (dayOfWeek > 5) {
      dayOfWeek = 1
      weekNumber++
    }
  }

  return days
}

/**
 * Count how many cities are split across multiple zones.
 * Returns { splitCities, totalCities } for quality metrics.
 */
function countCitySplits(chunks) {
  const cityZones = {} // city -> Set of zone indices
  for (let z = 0; z < chunks.length; z++) {
    for (const agency of chunks[z]) {
      const city = (agency.city || '').trim().toLowerCase()
      if (!city) continue
      if (!cityZones[city]) cityZones[city] = new Set()
      cityZones[city].add(z)
    }
  }

  let splitCities = 0
  const totalCities = Object.keys(cityZones).length
  for (const zones of Object.values(cityZones)) {
    if (zones.size > 1) splitCities++
  }

  return { splitCities, totalCities }
}

/**
 * Main route optimization function.
 * Creates 11 balanced zones, assigns to 1 FRM, 17 visits/day.
 *
 * @param {Array} agencies - all agencies to optimize
 * @param {object} options - { agenciesPerDay, numZones, numFRMs }
 * @param {object|null} supabase - Supabase client for drive time caching (null to skip)
 * @param {string|null} apiKey - Google Distance Matrix API key (null to skip)
 */
export async function optimizeRoutes(agencies, options = {}, supabase = null, apiKey = null) {
  const {
    agenciesPerDay = 17,
    numZones = 11,
    numFRMs = 1
  } = options

  console.log(`Starting route optimization for ${agencies.length} agencies`)
  console.log(`Target: ${numZones} zones, ${numFRMs} FRM(s), ${agenciesPerDay} visits/day`)
  console.log(`Drive-time optimization: ${supabase && apiKey ? 'ENABLED' : 'DISABLED (Haversine fallback)'}`)

  // Step 1: Filter geocoded agencies
  const geocodedAgencies = agencies.filter(a =>
    a.latitude && a.longitude &&
    !isNaN(parseFloat(a.latitude)) && !isNaN(parseFloat(a.longitude))
  )

  console.log(`Found ${geocodedAgencies.length} geocoded agencies`)

  if (geocodedAgencies.length === 0) {
    throw new Error('No geocoded agencies found')
  }

  // Step 2: Balanced K-Means clustering
  console.log(`Running K-Means to find ${numZones} centroids...`)
  const centroids = findCentroids(geocodedAgencies, numZones)

  console.log(`Assigning agencies to zones with balanced distribution...`)
  let chunks = balancedAssignment(geocodedAgencies, centroids, numZones)

  console.log(`Clustered ${geocodedAgencies.length} agencies into ${chunks.length} zones: [${chunks.map(c => c.length).join(', ')}]`)

  // Step 2.5: City coherence refinement
  console.log('Refining zones for city coherence...')
  const beforeSplits = countCitySplits(chunks)
  chunks = refineCityCoherence(chunks, numZones)
  const afterSplits = countCitySplits(chunks)
  console.log(`City splits: ${beforeSplits.splitCities} → ${afterSplits.splitCities} (of ${afterSplits.totalCities} cities)`)

  // Step 2.6: Outlier removal
  console.log('Removing geographic outliers...')
  chunks = removeOutliers(chunks, numZones)

  console.log(`Final zone sizes: [${chunks.map(c => c.length).join(', ')}]`)

  // Step 3: Build zones with daily schedules
  const zones = []
  let totalDriveTimeMinutes = 0
  let dayGroupCount = 0

  for (let i = 0; i < chunks.length; i++) {
    const zoneAgencies = chunks[i]

    if (zoneAgencies.length === 0) continue

    // Sort by proximity within zone for efficient travel (initial ordering)
    const proximitySorted = sortAgenciesByProximity(zoneAgencies)

    // Build daily schedule (17 per day, cycling through weeks)
    const dailyAssignments = buildDailySchedule(proximitySorted, agenciesPerDay)

    // Step 4: Re-optimize each day's route using drive times
    const optimizedDailyAssignments = []
    const dailyStats = []

    for (const day of dailyAssignments) {
      const result = await optimizeDailyRoute(day.agencies, supabase, apiKey)

      optimizedDailyAssignments.push({
        dayOfWeek: day.dayOfWeek,
        weekNumber: day.weekNumber,
        agencies: result.agencies,
        estimatedDriveMinutes: result.estimatedDriveMinutes,
        estimatedDistanceMiles: result.estimatedDistanceMiles
      })

      if (result.estimatedDriveMinutes) {
        totalDriveTimeMinutes += result.estimatedDriveMinutes
        dayGroupCount++
      }

      dailyStats.push({
        dayOfWeek: day.dayOfWeek,
        weekNumber: day.weekNumber,
        estimatedDriveMinutes: result.estimatedDriveMinutes,
        estimatedDistanceMiles: result.estimatedDistanceMiles,
        agencyCount: result.agencies.length
      })
    }

    // Calculate zone centroid
    const centroidLat = zoneAgencies.reduce((sum, a) => sum + parseFloat(a.latitude), 0) / zoneAgencies.length
    const centroidLng = zoneAgencies.reduce((sum, a) => sum + parseFloat(a.longitude), 0) / zoneAgencies.length

    // How many working days to visit all agencies in this zone
    const totalDays = optimizedDailyAssignments.length

    zones.push({
      zoneNumber: i + 1,
      zoneName: `Zone ${String.fromCharCode(65 + i)}`,
      totalAgencies: zoneAgencies.length,
      centroidLat,
      centroidLng,
      dailyAssignments: optimizedDailyAssignments,
      dailyStats,
      totalDays,
      avgPerDay: agenciesPerDay
    })
  }

  // Step 5: Assign all zones to FRM(s)
  const zonesPerFRM = Math.ceil(zones.length / numFRMs)
  const frmAssignments = []

  for (let f = 0; f < numFRMs; f++) {
    const frmZones = zones.slice(f * zonesPerFRM, (f + 1) * zonesPerFRM)
    const totalAgencies = frmZones.reduce((sum, z) => sum + z.totalAgencies, 0)
    const totalFrmDays = frmZones.reduce((sum, z) => sum + z.totalDays, 0)

    const dailySchedule = []
    for (const zone of frmZones) {
      for (const day of zone.dailyAssignments) {
        dailySchedule.push({
          ...day,
          zoneName: zone.zoneName,
          zoneNumber: zone.zoneNumber
        })
      }
    }

    dailySchedule.sort((a, b) => a.weekNumber - b.weekNumber || a.dayOfWeek - b.dayOfWeek)

    frmAssignments.push({
      frmNumber: f + 1,
      frmName: `FRM ${f + 1}`,
      zones: frmZones.map(z => z.zoneName),
      zoneCount: frmZones.length,
      totalAgencies,
      totalDays: totalFrmDays,
      dailySchedule
    })
  }

  // Step 6: Stats
  const totalAgencies = geocodedAgencies.length
  const avgDriveMinutes = dayGroupCount > 0 ? Math.round(totalDriveTimeMinutes / dayGroupCount * 10) / 10 : null

  const stats = {
    totalAgencies,
    geocodedAgencies: geocodedAgencies.length,
    zonesCreated: zones.length,
    numFRMs,
    agenciesPerDay,
    algorithm: supabase && apiKey ? 'balanced-kmeans-drivetime' : 'balanced-kmeans',
    citySplits: afterSplits.splitCities,
    totalCities: afterSplits.totalCities,
    avgDailyDriveMinutes: avgDriveMinutes,
    driveTimeOptimized: dayGroupCount,
    frmSummary: frmAssignments.map(f => ({
      name: f.frmName,
      zones: f.zones,
      totalAgencies: f.totalAgencies
    }))
  }

  console.log('Optimization complete:', JSON.stringify(stats, null, 2))

  return {
    zones,
    frmAssignments,
    stats
  }
}

/**
 * Find nearest zone for a new agency (for temporary assignment)
 */
export function findNearestZone(agency, zones) {
  if (!agency.latitude || !agency.longitude) {
    throw new Error('Agency must be geocoded')
  }

  let nearestZone = null
  let nearestDistance = Infinity

  zones.forEach(zone => {
    const distance = haversineDistance(
      agency.latitude,
      agency.longitude,
      zone.centroidLat,
      zone.centroidLng
    )

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestZone = zone
    }
  })

  return nearestZone
}
