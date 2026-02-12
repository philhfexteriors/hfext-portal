/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API for tactile feedback on supported devices
 */

/**
 * Trigger a light haptic feedback (for UI interactions like button taps)
 */
export function hapticLight() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10) // 10ms vibration
  }
}

/**
 * Trigger a medium haptic feedback (for important actions)
 */
export function hapticMedium() {
  if ('vibrate' in navigator) {
    navigator.vibrate(25) // 25ms vibration
  }
}

/**
 * Trigger a heavy haptic feedback (for critical actions or success)
 */
export function hapticHeavy() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50) // 50ms vibration
  }
}

/**
 * Trigger a success pattern haptic feedback
 */
export function hapticSuccess() {
  if ('vibrate' in navigator) {
    navigator.vibrate([10, 50, 10]) // Double tap pattern
  }
}

/**
 * Trigger an error pattern haptic feedback
 */
export function hapticError() {
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 50]) // Triple tap pattern
  }
}
