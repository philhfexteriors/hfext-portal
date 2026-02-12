/**
 * Compute the convex hull of a set of 2D points using Gift Wrapping (Jarvis March).
 * @param {Array<[number, number]>} points - Array of [lat, lng] pairs
 * @returns {Array<[number, number]>} - Ordered hull vertices
 */
export function computeConvexHull(points) {
  // Need at least 3 unique points for a polygon
  const unique = []
  const seen = new Set()
  for (const p of points) {
    const key = `${p[0]},${p[1]}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(p)
    }
  }

  if (unique.length < 3) return []

  // Find the leftmost point (minimum longitude, then minimum latitude)
  let startIdx = 0
  for (let i = 1; i < unique.length; i++) {
    if (unique[i][1] < unique[startIdx][1] ||
        (unique[i][1] === unique[startIdx][1] && unique[i][0] < unique[startIdx][0])) {
      startIdx = i
    }
  }

  const hull = []
  let current = startIdx

  do {
    hull.push(unique[current])
    let next = 0

    for (let i = 1; i < unique.length; i++) {
      if (next === current) {
        next = i
        continue
      }

      // Cross product to determine turn direction
      const cross = crossProduct(unique[current], unique[next], unique[i])

      if (cross < 0) {
        // i is more counterclockwise than next
        next = i
      } else if (cross === 0) {
        // Collinear - pick the farther point
        if (distSq(unique[current], unique[i]) > distSq(unique[current], unique[next])) {
          next = i
        }
      }
    }

    current = next

    // Safety: prevent infinite loop
    if (hull.length > unique.length) break
  } while (current !== startIdx)

  return hull
}

function crossProduct(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function distSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
}
