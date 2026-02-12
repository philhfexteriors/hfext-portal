'use client'

import { useMemo } from 'react'
import { calculateQualityStats } from '@/lib/frm/dataQuality'

export default function DataQualityStats({ agencies, contacts }) {
  const stats = useMemo(() => {
    return calculateQualityStats(agencies, contacts)
  }, [agencies, contacts])

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">Data Quality Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Agencies"
          value={`${stats.agencies.complete}/${stats.agencies.total}`}
          sublabel={`${stats.agencies.percentComplete}% complete`}
          color={stats.agencies.percentComplete >= 90 ? 'green' : stats.agencies.percentComplete >= 70 ? 'yellow' : 'red'}
        />

        <StatCard
          label="Incomplete Agencies"
          value={stats.agencies.incomplete}
          sublabel="Need attention"
          color="yellow"
        />

        <StatCard
          label="Contacts"
          value={`${stats.contacts.complete}/${stats.contacts.total}`}
          sublabel={`${stats.contacts.percentComplete}% complete`}
          color={stats.contacts.percentComplete >= 90 ? 'green' : stats.contacts.percentComplete >= 70 ? 'yellow' : 'red'}
        />

        <StatCard
          label="Incomplete Contacts"
          value={stats.contacts.incomplete}
          sublabel="Missing email/phone"
          color="yellow"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel, color }) {
  const colorClasses = {
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    red: 'border-red-200 bg-red-50'
  }

  return (
    <div className={`border rounded-lg p-3 ${colorClasses[color]}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{sublabel}</div>
    </div>
  )
}
