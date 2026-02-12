'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import AppShell from '@/components/frm/AppShell'
import NotesSearchFilters from '@/components/frm/NotesSearchFilters'
import NotesSearchResults from '@/components/frm/NotesSearchResults'
import EditVisitDrawer from '@/components/frm/EditVisitDrawer'
import ErrorMessage from '@/components/frm/ErrorMessage'
import { hapticLight } from '@/lib/frm/utils/haptics'
import toast from 'react-hot-toast'

export default function NotesSearch() {
  const { user } = useAuth()
  const supabase = createClient()

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filter states
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [selectedFRMs, setSelectedFRMs] = useState([])
  const [selectedAgency, setSelectedAgency] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)

  // Pagination state
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Edit drawer state
  const [editingVisit, setEditingVisit] = useState(null)
  const [showEditDrawer, setShowEditDrawer] = useState(false)

  // Reference data
  const [frms, setFRMs] = useState([])
  const [agencies, setAgencies] = useState([])
  const [zones, setZones] = useState([])

  // Fetch reference data on mount
  useEffect(() => {
    fetchReferenceData()
  }, [user])

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        setDebouncedSearch(searchTerm.trim())
        setOffset(0) // Reset pagination on new search
      } else {
        setDebouncedSearch('')
        setResults([])
        setTotalCount(0)
        setHasMore(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Execute search when debounced term or filters change
  useEffect(() => {
    if (debouncedSearch) {
      performSearch(false)
    }
  }, [debouncedSearch, dateRange, selectedFRMs, selectedAgency, selectedZone])

  async function fetchReferenceData() {
    try {
      // Fetch FRMs
      const { data: frmsData } = await supabase
        .from('frms')
        .select('id, name, email')
        .eq('active', true)
        .order('name')

      setFRMs(frmsData || [])

      // Fetch Agencies (limit to reasonable number for dropdown)
      const { data: agenciesData } = await supabase
        .from('agencies')
        .select('id, name, city, state')
        .order('name')
        .limit(500)

      setAgencies(agenciesData || [])

      // Fetch Zones
      const { data: zonesData } = await supabase
        .from('zones')
        .select('id, name')
        .order('name')

      setZones(zonesData || [])
    } catch (err) {
      console.error('Error fetching reference data:', err)
    }
  }

  async function performSearch(loadMore = false) {
    try {
      setLoading(true)
      setError(null)

      const currentOffset = loadMore ? offset : 0
      const limit = 200

      // Build base query
      let query = supabase
        .from('visits')
        .select(`
          *,
          agencies (id, name, city, state),
          frms (id, name, email)
        `, { count: 'exact' })
        .not('conversation_notes', 'is', null)
        .ilike('conversation_notes', `%${debouncedSearch}%`)

      // Apply date range filter
      if (dateRange.start) {
        query = query.gte('visit_date', dateRange.start)
      }
      if (dateRange.end) {
        query = query.lte('visit_date', dateRange.end)
      }

      // Apply FRM filter (only if selections exist)
      if (selectedFRMs.length > 0) {
        query = query.in('frm_id', selectedFRMs)
      }

      // Apply agency filter
      if (selectedAgency) {
        query = query.eq('agency_id', selectedAgency)
      }

      // Apply zone filter (through FRM assignments)
      if (selectedZone) {
        const { data: frmZones } = await supabase
          .from('frm_zones')
          .select('frm_id')
          .eq('zone_id', selectedZone)

        if (frmZones && frmZones.length > 0) {
          const frmIds = frmZones.map(fz => fz.frm_id)
          query = query.in('frm_id', frmIds)
        } else {
          // No FRMs in this zone, return empty results
          setResults([])
          setTotalCount(0)
          setHasMore(false)
          setLoading(false)
          return
        }
      }

      // Execute query with ordering and pagination
      const { data, error: searchError, count } = await query
        .order('visit_date', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1)

      if (searchError) throw searchError

      // Update results
      if (loadMore) {
        setResults(prev => [...prev, ...(data || [])])
      } else {
        setResults(data || [])
      }

      setTotalCount(count || 0)
      setHasMore((count || 0) > currentOffset + (data?.length || 0))
      setOffset(currentOffset + (data?.length || 0))

    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search notes. Please try again.')
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(visit) {
    setEditingVisit(visit)
    setShowEditDrawer(true)
  }

  function closeEditDrawer() {
    setShowEditDrawer(false)
    setEditingVisit(null)
  }

  async function handleSaveEdit(visitId, updates) {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          conversation_notes: updates.notes.trim() || null
        })
        .eq('id', visitId)

      if (error) throw error

      toast.success('Visit updated successfully')
      closeEditDrawer()

      // Refresh search results
      await performSearch(false)

    } catch (err) {
      console.error('Error updating visit:', err)
      toast.error('Failed to update visit')
    }
  }

  function handleClearAllFilters() {
    setDateRange({ start: null, end: null })
    setSelectedFRMs([])
    setSelectedAgency(null)
    setSelectedZone(null)
  }

  function handleLoadMore() {
    performSearch(true)
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#9D2235' }}>
              Notes Search
            </h1>
            <p className="text-gray-600">
              Search conversation notes across all visits
            </p>
          </div>

          {/* Search Input */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search conversation notes
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type at least 2 characters to search..."
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Character count hint */}
            {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
              <p className="text-xs text-gray-500 mt-2">
                Type at least 2 characters to search...
              </p>
            )}
          </div>

          {/* Filters */}
          <NotesSearchFilters
            dateRange={dateRange}
            setDateRange={setDateRange}
            frms={frms}
            selectedFRMs={selectedFRMs}
            setSelectedFRMs={setSelectedFRMs}
            selectedAgency={selectedAgency}
            setSelectedAgency={setSelectedAgency}
            agencies={agencies}
            zones={zones}
            selectedZone={selectedZone}
            setSelectedZone={setSelectedZone}
            onClearAll={handleClearAllFilters}
          />

          {/* Results */}
          <NotesSearchResults
            results={results}
            searchTerm={debouncedSearch}
            loading={loading}
            onEdit={handleEdit}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            totalCount={totalCount}
          />

          {/* Error State */}
          {error && (
            <div className="mt-4">
              <ErrorMessage message={error} />
              <button
                onClick={() => performSearch(false)}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Retry Search
              </button>
            </div>
          )}
        </div>

        {/* Edit Drawer */}
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
