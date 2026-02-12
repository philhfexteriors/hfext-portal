import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for auto-saving draft data to localStorage.
 * Returns [savedValue, setSavedValue, clearDraft, draftSaved] where:
 * - savedValue: the current value (initialized from localStorage if available)
 * - setSavedValue: setter that also triggers a save to localStorage
 * - clearDraft: function to remove the draft from localStorage
 * - draftSaved: boolean that flashes true for 2s after each save
 */
export function useDraftSave(key, defaultValue = '') {
  const [value, setValue] = useState(defaultValue)
  const [draftSaved, setDraftSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const draft = JSON.parse(saved)
        setValue(draft.value ?? draft.notes ?? defaultValue)
      }
    } catch (err) {
      console.error('Error loading draft:', err)
    }
    setInitialized(true)
  }, [key, defaultValue])

  // Save to localStorage when value changes (after initialization)
  useEffect(() => {
    if (!initialized) return

    if (value && value !== defaultValue) {
      const draft = {
        value,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(key, JSON.stringify(draft))
      setDraftSaved(true)

      const timer = setTimeout(() => {
        setDraftSaved(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [value, key, initialized, defaultValue])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    setValue(defaultValue)
  }, [key, defaultValue])

  return [value, setValue, clearDraft, draftSaved]
}
