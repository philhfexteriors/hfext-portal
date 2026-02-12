'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import toast from 'react-hot-toast'

export default function UnassignedAgencies() {
  const supabase = createClient()
  const router = useRouter()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, has_visits, no_visits

  useEffect(() => {
    fetchUnassignedAgencies()
  }, [filter])

  async function fetchUnassignedAgencies() {
    setLoading(true)
    try {
      // First, get all agency IDs that ARE assigned to zones
      const { data: assignedIds, error: assignError } = await supabase
        .from('zone_assignments')
        .select('agency_id')

      if (assignError) throw assignError

      const assignedAgencyIds = assignedIds?.map(a => a.agency_id) || []

      // Build query for unassigned agencies
      let query = supabase
        .from('agencies')
        .select(`
          *,
          visits (count)
        `)

      // If there are assigned agencies, exclude them
      if (assignedAgencyIds.length > 0) {
        query = query.not('id', 'in', `(${assignedAgencyIds.join(',')})`)
      }

      query = query.order('name')

      const { data, error } = await query

      if (error) throw error

      let filteredData = data || []

      // Apply visit filter
      if (filter === 'has_visits') {
        filteredData = filteredData.filter(a => a.visits?.[0]?.count > 0)
      } else if (filter === 'no_visits') {
        filteredData = filteredData.filter(a => !a.visits?.[0]?.count || a.visits?.[0]?.count === 0)
      }

      setAgencies(filteredData)
    } catch (err) {
      console.error('Error fetching unassigned agencies:', err)
      toast.error('Failed to load unassigned agencies')
    } finally {
      setLoading(false)
    }
  }

  function viewAgency(agencyId, agencyName) {
    router.push(`/agency-lookup?agencyId=${agencyId}&agencyName=${encodeURIComponent(agencyName)}`)
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#9D2235' }}>
              Unassigned Agencies
            </h1>
            <p className="text-gray-600">
              Agencies not currently assigned to any zone
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex gap-2 p-2 border-b">
              {[
                { key: 'all', label: 'All' },
                { key: 'has_visits', label: 'Has Visits' },
                { key: 'no_visits', label: 'Never Visited' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded font-medium transition ${
                    filter === tab.key
                      ? 'bg-purple-100 text-purple-800'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              <div className="text-sm text-gray-500 mb-4">
                {loading ? 'Loading...' : `${agencies.length} agencies found`}
              </div>

              {loading ? (
                <Loading />
              ) : agencies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {filter === 'all'
                    ? 'All agencies are assigned to zones!'
                    : filter === 'has_visits'
                    ? 'No unassigned agencies with visits'
                    : 'No unassigned agencies without visits'
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {agencies.map(agency => (
                    <div
                      key={agency.id}
                      className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                      onClick={() => viewAgency(agency.id, agency.name)}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{agency.name}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            {agency.address && (
                              <div>📍 {agency.address}, {agency.city}, {agency.state} {agency.zip}</div>
                            )}
                            {!agency.address && (
                              <div>📍 {agency.city}, {agency.state} {agency.zip}</div>
                            )}
                            {agency.phone && (
                              <div>📞 {agency.phone}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Not in Zone
                          </span>
                          {agency.visits?.[0]?.count > 0 && (
                            <span className="text-xs text-gray-500">
                              {agency.visits[0].count} visit{agency.visits[0].count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          {!loading && agencies.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-800">
                    {agencies.length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Total Unassigned
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-800">
                    {agencies.filter(a => a.visits?.[0]?.count > 0).length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    With Visit History
                  </div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-800">
                    {agencies.filter(a => !a.visits?.[0]?.count || a.visits?.[0]?.count === 0).length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Never Visited
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  )
}
