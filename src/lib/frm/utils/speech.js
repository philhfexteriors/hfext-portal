/**
 * Speech recognition utility for voice-to-text input
 * Uses the Web Speech API (SpeechRecognition)
 */

let recognition = null

/**
 * Check if speech recognition is supported
 */
export function isSpeechRecognitionSupported() {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

/**
 * Initialize speech recognition
 * @param {Object} options - Configuration options
 * @param {Function} options.onResult - Callback when speech is recognized
 * @param {Function} options.onError - Callback when an error occurs
 * @param {Function} options.onEnd - Callback when recognition ends
 * @param {boolean} options.continuous - Whether to continue listening (default: false)
 * @param {string} options.lang - Language code (default: 'en-US')
 */
export function initializeSpeechRecognition({
  onResult,
  onError,
  onEnd,
  continuous = false,
  lang = 'en-US'
}) {
  if (!isSpeechRecognitionSupported()) {
    if (onError) {
      onError(new Error('Speech recognition not supported in this browser'))
    }
    return null
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  recognition = new SpeechRecognition()
  recognition.continuous = continuous
  recognition.interimResults = true
  recognition.lang = lang

  recognition.onresult = (event) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' '
      } else {
        interimTranscript += transcript
      }
    }

    if (onResult) {
      onResult({
        finalTranscript: finalTranscript.trim(),
        interimTranscript: interimTranscript.trim(),
        isFinal: finalTranscript !== ''
      })
    }
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error)
    if (onError) {
      onError(event)
    }
  }

  recognition.onend = () => {
    if (onEnd) {
      onEnd()
    }
  }

  return recognition
}

/**
 * Start listening for speech
 */
export function startListening() {
  if (recognition) {
    try {
      recognition.start()
      return true
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      return false
    }
  }
  return false
}

/**
 * Stop listening for speech
 */
export function stopListening() {
  if (recognition) {
    try {
      recognition.stop()
      return true
    } catch (error) {
      console.error('Error stopping speech recognition:', error)
      return false
    }
  }
  return false
}

/**
 * Abort listening immediately
 */
export function abortListening() {
  if (recognition) {
    try {
      recognition.abort()
      return true
    } catch (error) {
      console.error('Error aborting speech recognition:', error)
      return false
    }
  }
  return false
}
