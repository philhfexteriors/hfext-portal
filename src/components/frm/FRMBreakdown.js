'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'

export default function FRMBreakdown({ visits, frms }) {
  const router = useRouter()

  const frmStats = useMemo(() => {
    const stats = {}

    // Initialize stats for all FRMs
    frms.forEach(frm => {
      stats[frm.id] = {
        name: frm.name,
        total: 0
      }
    })

    // Count visits per FRM
    visits.forEach(visit => {
      const frmId = visit.frm_id
      if (stats[frmId]) {
        stats[frmId].total++
      }
    })

    // Convert to array and sort by total visits (descending)
    const result = Object.values(stats).sort((a, b) => b.total - a.total)

    // Return only top 5
    return result.slice(0, 5)
  }, [visits, frms])

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">FRM Breakdown (Top 5)</h2>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">FRM</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total Visits</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {frmStats.map((stat, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{stat.name}</td>
                <td className="px-4 py-3 text-sm text-right">{stat.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => router.push('/marketing/frm/frm-breakdown')}
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
