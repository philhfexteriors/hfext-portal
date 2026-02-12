'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export default function InlineEditField({
  label,
  value,
  fieldName,
  onSave,
  type = 'text',
  required = false,
  placeholder = '',
  isMissing = false
}) {
  const [editing, setEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (required && !currentValue.trim()) {
      toast.error(`${label} is required`)
      return
    }

    try {
      setSaving(true)
      await onSave(fieldName, currentValue.trim() || null)
      setEditing(false)
      toast.success(`${label} updated`)
    } catch (err) {
      console.error('Error saving field:', err)
      toast.error(`Failed to update ${label}`)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setCurrentValue(value || '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded transition group">
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
          <div className={`text-sm ${!value ? 'text-gray-400 italic' : 'text-gray-900'}`}>
            {value || 'Not set'}
            {isMissing && !value && (
              <span className="ml-2 text-yellow-600 text-xs">⚠️</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 text-xs underline transition"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="py-2 px-3 bg-blue-50 rounded">
      <div className="text-xs font-medium text-gray-700 mb-2">{label}</div>
      <div className="flex gap-2">
        <input
          type={type}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          className="flex-1 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '...' : '✓'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="px-3 py-1.5 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Press Enter to save, Esc to cancel
      </div>
    </div>
  )
}
