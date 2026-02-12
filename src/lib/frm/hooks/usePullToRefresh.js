import { useEffect, useRef, useState } from 'react'

/**
 * Custom hook for pull-to-refresh functionality on mobile
 * @param {Function} onRefresh - Async function to call when refresh is triggered
 * @param {number} threshold - Distance in pixels to trigger refresh (default 80)
 * @returns {Object} - { refreshing, pullDistance } for UI feedback
 */
export function usePullToRefresh(onRefresh, threshold = 80) {
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const pulling = useRef(false)

  useEffect(() => {
    let touchStartY = 0
    let touchMoveY = 0

    const handleTouchStart = (e) => {
      // Only trigger if at top of page
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY
        startY.current = touchStartY
        pulling.current = true
      }
    }

    const handleTouchMove = (e) => {
      if (!pulling.current || refreshing) return

      touchMoveY = e.touches[0].clientY
      const distance = touchMoveY - touchStartY

      // Only pull down, not up
      if (distance > 0 && window.scrollY === 0) {
        // Apply resistance to make it feel natural
        const adjustedDistance = Math.min(distance * 0.5, threshold * 1.5)
        setPullDistance(adjustedDistance)

        // Prevent default scroll behavior when pulling
        if (distance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = async () => {
      if (!pulling.current) return

      pulling.current = false

      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true)
        setPullDistance(threshold)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh error:', error)
        } finally {
          setRefreshing(false)
          setPullDistance(0)
        }
      } else {
        // Snap back if didn't reach threshold
        setPullDistance(0)
      }
    }

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, threshold, refreshing, pullDistance])

  return { refreshing, pullDistance }
}
