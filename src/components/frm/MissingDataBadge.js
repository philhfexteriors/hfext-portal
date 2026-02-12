'use client'

import { formatMissingFields } from '@/lib/frm/dataQuality'
import { useState } from 'react'

export default function MissingDataBadge({ type, missing, size = 'md', variant = 'warning' }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!missing || missing.length === 0) return null

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  }

  const colorClasses = {
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300'
  }

  const icon = missing.length >= 3 ? '❌' : '⚠️'

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`
          inline-flex items-center gap-1 rounded-full border font-medium
          ${sizeClasses[size]}
          ${colorClasses[variant]}
        `}
      >
        <span>{icon}</span>
        <span className="hidden sm:inline">{missing.length} missing</span>
        <span className="sm:hidden">{missing.length}</span>
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          Missing: {formatMissingFields(missing)}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  )
}
