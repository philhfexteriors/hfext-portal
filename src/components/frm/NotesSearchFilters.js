'use client'

import { useState } from 'react'
import { hapticLight } from '@/lib/frm/utils/haptics'
import { getLocalDateString } from '@/lib/frm/dateUtils'

export default function NotesSearchFilters({
  // Date Range
  dateRange,
  setDateRange,

  // FRM Filter
  frms,
  selectedFRMs,
  setSelectedFRMs,

  // Agency Filter
  selectedAgency,
  setSelectedAgency,
  agencies,

  // Zone Filter
  zones,
  selectedZone,
  setSelectedZone,

  // Clear all function
  onClearAll
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Calculate active filter count
  const activeFilterCount = [
    dateRange.start || dateRange.end,
    selectedFRMs.length > 0,
    selectedAgency,
    selectedZone
  ].filter(Boolean).length

  function toggleFRM(frmId) {
    hapticLight()
    setSelectedFRMs(prev =>
      prev.includes(frmId)
        ? prev.filter(id => id !== frmId)
        : [...prev, frmId]
    )
  }

  function handleClearAll() {
    hapticLight()
    if (onClearAll) {
      onClearAll()
    }
  }

  function handleToggleCollapse() {
    hapticLight()
    setIsCollapsed(!isCollapsed)
  }

  function setDatePreset(preset) {
    hapticLight()
    const today = getLocalDateString()

    switch (preset) {
      case 'today':
        setDateRange({ start: today, end: today })
        break
      case 'week':
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        setDateRange({
          start: getLocalDateString(weekAgo),
          end: today
        })
        break
      case 'month':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        setDateRange({
          start: getLocalDateString(monthAgo),
          end: today
        })
        break
      case 'ytd':
        const yearStart = new Date(new Date().getFullYear(), 0, 1)
        setDateRange({
          start: getLocalDateString(yearStart),
          end: today
        })
        break
      default:
        break
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      {/* Header with collapse toggle */}
      <button
        onClick={handleToggleCollapse}
        className="flex justify-between items-center w-full mb-4"
      >
        <h2 className="font-bold text-lg">
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </h2>
        <span className="text-gray-500">
          {isCollapsed ? '▼' : '▲'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* Date Range Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setDatePreset('today')}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setDatePreset('week')}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDatePreset('month')}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setDatePreset('ytd')}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                Year to Date
              </button>
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start || ''}
                  onChange={(e) => {
                    hapticLight()
                    setDateRange(prev => ({ ...prev, start: e.target.value }))
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end || ''}
                  onChange={(e) => {
                    hapticLight()
                    setDateRange(prev => ({ ...prev, end: e.target.value }))
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* FRM Multi-Select Section */}
          {frms && frms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                FRM Selection
              </label>
              <div className="flex flex-wrap gap-2">
                {frms.map(frm => (
                  <button
                    key={frm.id}
                    onClick={() => toggleFRM(frm.id)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      selectedFRMs.includes(frm.id)
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{
                      backgroundColor: selectedFRMs.includes(frm.id) ? '#9D2235' : undefined
                    }}
                  >
                    {frm.name}
                  </button>
                ))}
              </div>
              {selectedFRMs.length > 0 && (
                <button
                  onClick={() => {
                    hapticLight()
                    setSelectedFRMs([])
                  }}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Clear FRM selection
                </button>
              )}
            </div>
          )}

          {/* Agency Dropdown Section */}
          {agencies && agencies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agency (Optional)
              </label>
              <select
                value={selectedAgency || ''}
                onChange={(e) => {
                  hapticLight()
                  setSelectedAgency(e.target.value || null)
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Agencies</option>
                {agencies.map(agency => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} - {agency.city}, {agency.state}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zone Dropdown Section */}
          {zones && zones.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zone/Territory (Optional)
              </label>
              <select
                value={selectedZone || ''}
                onChange={(e) => {
                  hapticLight()
                  setSelectedZone(e.target.value || null)
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear All Filters Button */}
          {activeFilterCount > 0 && (
            <div className="pt-2 border-t">
              <button
                onClick={handleClearAll}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
