'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import { usePullToRefresh } from '@/lib/frm/hooks/usePullToRefresh'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import EditVisitDrawer from '@/components/frm/EditVisitDrawer'
import toast from 'react-hot-toast'

export default function RecentVisitsFull() {
  const { user } = useAuth()
  const supabase = createClient()

  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(100)
  const [timeFilter, setTimeFilter] = useState('today')
  const [editingVisit, setEditingVisit] = useState(null)
  const [showEditDrawer, setShowEditDrawer] = useState(false)

  // Pull-to-refresh functionality
  const handleRefresh = useCallback(async () => {
    if (user) {
      await fetchVisits()
      toast.success('Refreshed!')
    }
  }, [user])

  const { refreshing, pullDistance } = usePullToRefresh(handleRefresh)

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
          .select(`
            *,
            agencies (id, name, city, state),
            frms (id, name, email)
          `)
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

  const filteredVisits = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let filtered = visits

    switch (timeFilter) {
      case 'today':
        filtered = visits.filter(v => parseLocalDate(v.visit_date) >= today)
        break
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        filtered = visits.filter(v => parseLocalDate(v.visit_date) >= weekStart)
        break
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        filtered = visits.filter(v => parseLocalDate(v.visit_date) >= monthStart)
        break
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        filtered = visits.filter(v => parseLocalDate(v.visit_date) >= yearStart)
        break
      default:
        filtered = visits
    }

    return filtered.slice(0, limit)
  }, [visits, timeFilter, limit])

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

  function handleEdit(visit) {
    setEditingVisit(visit)
    setShowEditDrawer(true)
  }

  function closeEditDrawer() {
    setShowEditDrawer(false)
    setEditingVisit(null)
  }

  async function handleSaveEdit() {
    await fetchVisits()
    closeEditDrawer()
  }

  async function handleDelete(visitId) {
    if (!confirm('Are you sure you want to delete this visit?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId)

      if (error) throw error

      toast.success('Visit deleted successfully')
      await fetchVisits()
    } catch (err) {
      console.error('Error deleting visit:', err)
      toast.error('Failed to delete visit')
    }
  }

  return (
    <AppShell fullWidth>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 lg:left-64 z-[60] flex items-center justify-center bg-[#9D2235] text-white transition-all"
          style={{
            height: `${Math.min(pullDistance, 60)}px`,
            opacity: refreshing ? 1 : pullDistance / 80
          }}
        >
          {refreshing ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            pullDistance >= 80 && <span className="text-sm font-medium">Release to refresh</span>
          )}
        </div>
      )}

      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>
          Recent Visits - Full List
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
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-3">
                {filteredVisits.map(visit => (
                  <div key={visit.id} className="border rounded-lg p-3 space-y-2">
                    <div className="font-semibold">{visit.agencies?.name}</div>
                    <div className="text-sm text-gray-600">
                      {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-600">
                      FRM: {visit.frms?.name}
                    </div>
                    {visit.conversation_notes && (
                      <div className="text-sm text-gray-700">
                        {visit.conversation_notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(visit)}
                        className="text-sm px-3 py-1 text-white rounded-lg font-semibold"
                        style={{ backgroundColor: '#5B6770' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(visit.id)}
                        className="text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto border rounded-lg">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Agency</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">FRM</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Notes</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {filteredVisits.map(visit => (
                        <tr key={visit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm">{visit.agencies?.name}</td>
                          <td className="px-4 py-3 text-sm">{visit.frms?.name}</td>
                          <td className="px-4 py-3 text-sm max-w-md truncate">
                            {visit.conversation_notes || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(visit)}
                                className="text-sm px-3 py-1 text-white rounded-lg font-semibold hover:shadow-md transition-all"
                                style={{ backgroundColor: '#5B6770' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a5761'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B6770'}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(visit.id)}
                                className="text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold hover:shadow-md transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                <span>{filteredVisits.length} results</span>
                {filteredVisits.length >= limit && (
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

      {showEditDrawer && (
        <EditVisitDrawer
          visit={editingVisit}
          onClose={closeEditDrawer}
          onSave={handleSaveEdit}
        />
      )}
    </AppShell>
  )
}
