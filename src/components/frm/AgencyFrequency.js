'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'

export default function AgencyFrequency({ visits, agencies }) {
  const router = useRouter()

  const agencyStats = useMemo(() => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())

    const stats = {}

    visits.forEach(visit => {
      const agencyId = visit.agency_id
      if (!stats[agencyId]) {
        stats[agencyId] = {
          agencyName: visit.agencies?.name || 'Unknown',
          total: 0,
          thisWeek: 0
        }
      }
      stats[agencyId].total++

      if (new Date(visit.visit_date) >= weekStart) {
        stats[agencyId].thisWeek++
      }
    })

    let result = Object.values(stats)

    // Sort by total visits (descending)
    result.sort((a, b) => b.total - a.total)

    // Return only top 5
    return result.slice(0, 5)
  }, [visits])

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">Agency Frequency (Top 5)</h2>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Agency name
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                Total visits
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                This week
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {agencyStats.map((stat, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{stat.agencyName}</td>
                <td className="px-4 py-3 text-sm text-right">{stat.total}</td>
                <td className="px-4 py-3 text-sm text-right">{stat.thisWeek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => router.push('/marketing/frm/agency-frequency')}
          className="px-6 py-2 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: '#9D2235' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8a1e2f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9D2235'}
        >
          Full List
        </button>
      </div>
    </div>
  )
}
