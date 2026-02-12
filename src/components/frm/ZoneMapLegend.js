'use client'

import { useState } from 'react'
import { hapticLight } from '@/lib/frm/utils/haptics'

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function ZoneMapLegend({
  zones,
  visibleZones,
  onToggleZone,
  selectedDay,
  onSelectDay,
  zoneColors,
  agenciesByZone,
  missingCount
}) {
  const [expanded, setExpanded] = useState(false)

  const allVisible = zones.every(z => visibleZones.has(z.id))

  const handleToggleAll = () => {
    hapticLight()
    if (allVisible) {
      zones.forEach(z => {
        if (visibleZones.has(z.id)) onToggleZone(z.id)
      })
    } else {
      zones.forEach(z => {
        if (!visibleZones.has(z.id)) onToggleZone(z.id)
      })
    }
  }

  return (
    <div className="absolute bottom-4 left-4 z-[1000] max-w-[280px]">
      {/* Collapsed toggle button */}
      {!expanded && (
        <button
          onClick={() => { hapticLight(); setExpanded(true) }}
          className="bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-4 py-2.5 text-sm font-semibold text-[#5B6770] hover:text-[#9D2235] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Zones ({visibleZones.size}/{zones.length})
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-lg overflow-hidden" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-900">Zones</span>
            <button
              onClick={() => { hapticLight(); setExpanded(false) }}
              className="text-[#5B6770] hover:text-[#9D2235] p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Day-of-week filter */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs font-semibold text-[#5B6770] mb-1.5">Filter by Day</div>
            <div className="flex gap-1">
              <button
                onClick={() => { hapticLight(); onSelectDay(null) }}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  !selectedDay
                    ? 'bg-[#9D2235] text-white'
                    : 'bg-gray-100 text-[#5B6770] hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {dayNames.map((name, i) => (
                <button
                  key={i}
                  onClick={() => { hapticLight(); onSelectDay(i + 1) }}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    selectedDay === i + 1
                      ? 'bg-[#9D2235] text-white'
                      : 'bg-gray-100 text-[#5B6770] hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Show/Hide all */}
          <div className="px-3 py-1.5 border-b border-gray-100">
            <button
              onClick={handleToggleAll}
              className="text-xs text-[#9D2235] font-medium hover:underline"
            >
              {allVisible ? 'Hide All' : 'Show All'}
            </button>
          </div>

          {/* Zone list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            {zones.map(zone => {
              const color = zoneColors[zone.id] || '#999'
              const isVisible = visibleZones.has(zone.id)
              const zoneData = agenciesByZone[zone.id]
              const count = selectedDay
                ? (zoneData?.dayAgencies[selectedDay]?.length || 0)
                : (zoneData?.agencies?.length || 0)

              return (
                <button
                  key={zone.id}
                  onClick={() => { hapticLight(); onToggleZone(zone.id) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                    !isVisible ? 'opacity-40' : ''
                  }`}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: isVisible ? color : '#ccc',
                      border: '2px solid white',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                      flexShrink: 0
                    }}
                  />
                  <span className="text-xs font-medium text-gray-900 flex-1 truncate">
                    {zone.custom_name || zone.zone_name}
                  </span>
                  <span className="text-xs text-[#5B6770]">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Missing coordinates notice */}
          {missingCount > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-yellow-50">
              <p className="text-xs text-yellow-700">
                {missingCount} {missingCount === 1 ? 'agency' : 'agencies'} not shown (no coordinates)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
