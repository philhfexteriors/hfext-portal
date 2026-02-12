'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'

export default function AgencyFrequencyFull() {
  const { user } = useAuth()
  const supabase = createClient()

  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(100)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('total')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    if (user) {
      fetchVisits()
    }
  }, [user])

  async function fetchVisits() {
    try {
      setLoading(true)

      // Fetch all visits with agency info in batches
      let allVisits = []
      let offset = 0
      const batchSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('visits')
          .select('agency_id, visit_date, agencies(name)')
          .order('visit_date', { ascending: false })
          .range(offset, offset + batchSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        allVisits = [...allVisits, ...data]
        if (data.length < batchSize) break
        offset += batchSize
      }

      setVisits(allVisits)
    } catch (err) {
      console.error('Error fetching visits:', err)
    } finally {
      setLoading(false)
    }
  }

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

      if (parseLocalDate(visit.visit_date) >= weekStart) {
        stats[agencyId].thisWeek++
      }
    })

    let result = Object.values(stats)

    // Apply search filter
    if (searchTerm) {
      result = result.filter(s =>
        s.agencyName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal

      if (sortField === 'agencyName') {
        aVal = a.agencyName.toLowerCase()
        bVal = b.agencyName.toLowerCase()
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        aVal = a[sortField]
        bVal = b[sortField]
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
    })

    return result.slice(0, limit)
  }, [visits, searchTerm, sortField, sortDirection, limit])

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'agencyName' ? 'asc' : 'desc')
    }
  }

  function SortIcon({ field }) {
    if (sortField !== field) {
      return <span className="text-gray-400">⇅</span>
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  function exportToCSV() {
    const csv = [
      ['Agency Name', 'Total Visits', 'This Week'],
      ...agencyStats.map(s => [s.agencyName, s.total, s.thisWeek])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'agency-frequency.csv'
    a.click()
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>
          Agency Frequency - Full List
        </h1>

        {loading ? (
          <Loading />
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <input
                type="text"
                placeholder="Search agencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-96 px-4 py-2 border rounded-lg"
              />
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                style={{ backgroundColor: '#5B6770' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a5761'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B6770'}
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th
                        onClick={() => handleSort('agencyName')}
                        className="px-4 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          Agency name <SortIcon field="agencyName" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('total')}
                        className="px-4 py-2 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Total visits <SortIcon field="total" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('thisWeek')}
                        className="px-4 py-2 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          This week <SortIcon field="thisWeek" />
                        </div>
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
            </div>

            <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
              <span>{agencyStats.length} results</span>
              {agencyStats.length >= limit && (
                <button
                  onClick={() => setLimit(prev => prev + 100)}
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: '#9D2235' }}
                >
                  Load more (100)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
