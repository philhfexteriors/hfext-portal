'use client'

import { useState, useEffect, useRef } from 'react'
import {
  isSpeechRecognitionSupported,
  initializeSpeechRecognition,
  startListening,
  stopListening
} from '@/lib/frm/utils/speech'
import { hapticLight } from '@/lib/frm/utils/haptics'

/**
 * Voice input button component
 * @param {Function} onTranscript - Callback to append transcript to text
 * @param {boolean} disabled - Whether button is disabled
 */
export default function VoiceInput({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    // Check if speech recognition is supported
    setIsSupported(isSpeechRecognitionSupported())

    // Initialize speech recognition
    if (isSpeechRecognitionSupported()) {
      recognitionRef.current = initializeSpeechRecognition({
        onResult: ({ finalTranscript, interimTranscript }) => {
          if (finalTranscript && onTranscript) {
            onTranscript(finalTranscript)
          }
        },
        onError: (error) => {
          console.error('Speech recognition error:', error)
          setIsListening(false)
        },
        onEnd: () => {
          setIsListening(false)
        },
        continuous: false,
        lang: 'en-US'
      })
    }

    return () => {
      if (isListening) {
        stopListening()
      }
    }
  }, [])

  const handleToggle = () => {
    hapticLight()

    if (!isSupported) {
      alert('Voice input is not supported in this browser. Try using Chrome or Safari.')
      return
    }

    if (isListening) {
      stopListening()
      setIsListening(false)
    } else {
      const started = startListening()
      if (started) {
        setIsListening(true)
      }
    }
  }

  if (!isSupported) {
    return null // Don't show button if not supported
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all ${
        isListening
          ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <rect x="6" y="4" width="8" height="12" rx="1" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  )
}
