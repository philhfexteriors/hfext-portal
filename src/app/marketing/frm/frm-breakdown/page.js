'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'

export default function FRMBreakdownFull() {
  const { user } = useAuth()
  const supabase = createClient()

  const [visits, setVisits] = useState([])
  const [frms, setFRMs] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(100)
  const [timeFilter, setTimeFilter] = useState('today')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('filtered')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch FRMs
      const { data: frmsData, error: frmsError } = await supabase
        .from('frms')
        .select('*')
        .order('name')

      if (frmsError) throw frmsError

      // Fetch all visits in batches
      let allVisits = []
      let offset = 0
      const batchSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('visits')
          .select('frm_id, visit_date')
          .order('visit_date', { ascending: false })
          .range(offset, offset + batchSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        allVisits = [...allVisits, ...data]
        if (data.length < batchSize) break
        offset += batchSize
      }

      setFRMs(frmsData)
      setVisits(allVisits)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const frmStats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const stats = {}

    // Initialize stats for all FRMs
    frms.forEach(frm => {
      stats[frm.id] = {
        name: frm.name,
        total: 0,
        filtered: 0
      }
    })

    // Count visits
    visits.forEach(visit => {
      const frmId = visit.frm_id
      if (!stats[frmId]) return

      const visitDate = parseLocalDate(visit.visit_date)
      stats[frmId].total++

      // Count based on time filter
      let includeInFilter = false
      switch (timeFilter) {
        case 'today':
          includeInFilter = visitDate >= today
          break
        case 'week':
          includeInFilter = visitDate >= weekStart
          break
        case 'month':
          includeInFilter = visitDate >= monthStart
          break
        case 'year':
          includeInFilter = visitDate >= yearStart
          break
        case 'all':
          includeInFilter = true
          break
      }

      if (includeInFilter) {
        stats[frmId].filtered++
      }
    })

    let result = Object.values(stats)

    // Apply search filter
    if (searchTerm) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal

      if (sortField === 'name') {
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
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
  }, [visits, frms, timeFilter, searchTerm, sortField, sortDirection, limit])

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'today':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
      case 'year':
        return 'This Year'
      case 'all':
        return 'All Time'
      default:
        return 'Filtered'
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'name' ? 'asc' : 'desc')
    }
  }

  function SortIcon({ field }) {
    if (sortField !== field) {
      return <span className="text-gray-400">⇅</span>
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  const FilterButton = ({ value, label }) => {
    const isActive = timeFilter === value
    return (
      <button
        onClick={() => setTimeFilter(value)}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          backgroundColor: isActive ? '#9D2235' : '#f3f4f6',
          color: isActive ? 'white' : '#374151'
        }}
      >
        {label}
      </button>
    )
  }

  function exportToCSV() {
    const csv = [
      ['FRM Name', getFilterLabel(), 'All Time Total'],
      ...frmStats.map(s => [s.name, s.filtered, s.total])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'frm-breakdown.csv'
    a.click()
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>
          FRM Breakdown - Full List
        </h1>

        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <FilterButton value="today" label="Today" />
                <FilterButton value="week" label="This Week" />
                <FilterButton value="month" label="This Month" />
                <FilterButton value="year" label="This Year" />
                <FilterButton value="all" label="All Time" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search FRMs..."
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
                          onClick={() => handleSort('name')}
                          className="px-4 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                        >
                          <div className="flex items-center gap-1">
                            FRM <SortIcon field="name" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('filtered')}
                          className="px-4 py-2 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            {getFilterLabel()} <SortIcon field="filtered" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('total')}
                          className="px-4 py-2 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            All Time <SortIcon field="total" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {frmStats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{stat.name}</td>
                          <td className="px-4 py-3 text-sm text-right">{stat.filtered}</td>
                          <td className="px-4 py-3 text-sm text-right">{stat.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                <span>{frmStats.length} results</span>
                {frmStats.length >= limit && (
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
          </>
        )}
      </div>
    </AppShell>
  )
}
