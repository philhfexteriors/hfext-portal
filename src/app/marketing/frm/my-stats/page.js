'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import ErrorMessage from '@/components/frm/ErrorMessage'
import WeeklyGoalProgress from '@/components/frm/WeeklyGoalProgress'
import WeeklyGoalHistory from '@/components/frm/WeeklyGoalHistory'
import { useAuth } from '@/components/AuthProvider'
import { isAdmin as checkAdmin } from '@/lib/frm/auth/roles'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import toast from 'react-hot-toast'

export default function MyStats() {
  const { user } = useAuth()
  const supabase = createClient()

  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [frmId, setFrmId] = useState(null)
  const [frmName, setFrmName] = useState('')
  const [dateRange, setDateRange] = useState('30') // days
  const [isAdmin, setIsAdmin] = useState(false)
  const [allFrms, setAllFrms] = useState([])
  const [selectedFrmId, setSelectedFrmId] = useState(null)

  useEffect(() => {
    if (user) {
      const adminCheck = checkAdmin(user.email)
      setIsAdmin(adminCheck)

      if (adminCheck) {
        fetchAllFrms()
      } else {
        fetchData()
      }
    }
  }, [user])

  useEffect(() => {
    if (user && !isAdmin) {
      fetchData()
    } else if (user && isAdmin && selectedFrmId) {
      fetchDataForFrm(selectedFrmId)
    }
  }, [dateRange, selectedFrmId])

  async function fetchAllFrms() {
    try {
      const { data: frmsData, error: frmsError } = await supabase
        .from('frms')
        .select('id, name, email')
        .order('name')

      if (frmsError) throw frmsError

      setAllFrms(frmsData || [])
      // Auto-select first FRM
      if (frmsData && frmsData.length > 0) {
        setSelectedFrmId(frmsData[0].id)
        fetchDataForFrm(frmsData[0].id)
      }
    } catch (err) {
      console.error('Error fetching FRMs:', err)
      setError('Failed to load FRM list')
      setLoading(false)
    }
  }

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      // Get FRM record
      const { data: frmData, error: frmError } = await supabase
        .from('frms')
        .select('id, name')
        .eq('email', user.email)
        .maybeSingle()

      if (frmError) throw frmError

      // If no FRM record found (admin user), show helpful message
      if (!frmData) {
        setError('You are not registered as an FRM. This page shows individual FRM statistics.')
        setLoading(false)
        return
      }

      setFrmId(frmData.id)
      setFrmName(frmData.name)

      await fetchDataForFrm(frmData.id)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load your stats. Please try again.')
      toast.error('Failed to load data')
      setLoading(false)
    }
  }

  async function fetchDataForFrm(frmIdToFetch) {
    try {
      setLoading(true)
      setError(null)

      // Get FRM name if we don't have it
      if (!frmName) {
        const { data: frmData } = await supabase
          .from('frms')
          .select('name')
          .eq('id', frmIdToFetch)
          .single()

        if (frmData) {
          setFrmName(frmData.name)
        }
      }

      // Calculate date filter
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(dateRange))
      const startDateStr = startDate.toISOString().split('T')[0]

      // Fetch visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          agencies (id, name, city, state)
        `)
        .eq('frm_id', frmIdToFetch)
        .gte('visit_date', startDateStr)
        .order('visit_date', { ascending: false })

      if (visitsError) throw visitsError

      setVisits(visitsData || [])

    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load stats. Please try again.')
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const totalVisits = visits.length
  const uniqueAgencies = new Set(visits.map(v => v.agency_id)).size

  const thisWeek = visits.filter(v => {
    const visitDate = parseLocalDate(v.visit_date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return visitDate >= weekAgo
  }).length

  const today = visits.filter(v => {
    const visitDate = parseLocalDate(v.visit_date).toDateString()
    const todayDate = new Date().toDateString()
    return visitDate === todayDate
  }).length

  // Group by week
  const visitsByWeek = {}
  visits.forEach(visit => {
    const date = parseLocalDate(visit.visit_date)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]

    if (!visitsByWeek[weekKey]) {
      visitsByWeek[weekKey] = 0
    }
    visitsByWeek[weekKey]++
  })

  const allWeeks = Object.keys(visitsByWeek).sort().reverse()
  const weeks = allWeeks.slice(0, 4) // Current + previous 3 weeks
  const avgPerWeek = allWeeks.length > 0 ? (totalVisits / allWeeks.length).toFixed(1) : 0

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold" style={{ color: '#9D2235' }}>
              My Stats
            </h1>
            <p className="text-gray-600 mt-1">{frmName}</p>
          </div>

          {error && <ErrorMessage message={error} />}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
            {/* FRM Selector (Admin only) */}
            {isAdmin && allFrms.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select FRM
                </label>
                <select
                  value={selectedFrmId || ''}
                  onChange={(e) => setSelectedFrmId(e.target.value)}
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
                >
                  {allFrms.map(frm => (
                    <option key={frm.id} value={frm.id}>
                      {frm.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last year</option>
              </select>
            </div>
          </div>

          {loading ? (
            <Loading />
          ) : (
            <>
              {/* Weekly Goal Widgets */}
              {(frmId || selectedFrmId) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <WeeklyGoalProgress frmId={frmId || selectedFrmId} />
                  <WeeklyGoalHistory frmId={frmId || selectedFrmId} />
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-3xl font-bold" style={{ color: '#9D2235' }}>
                    {totalVisits}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Total Visits</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-3xl font-bold text-blue-600">
                    {uniqueAgencies}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Unique Agencies</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-3xl font-bold text-green-600">
                    {thisWeek}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">This Week</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-3xl font-bold text-purple-600">
                    {avgPerWeek}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Avg Per Week</div>
                </div>
              </div>

              {/* Weekly Breakdown */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: '#9D2235' }}>
                  Weekly Breakdown
                </h2>
                <div className="space-y-3">
                  {weeks.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No visits in this time period</p>
                  ) : (
                    weeks.map(week => {
                      const weekEnd = new Date(week)
                      weekEnd.setDate(weekEnd.getDate() + 6)
                      const count = visitsByWeek[week]
                      const maxCount = Math.max(...Object.values(visitsByWeek))
                      const percentage = (count / maxCount) * 100

                      return (
                        <div key={week}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">
                              {new Date(week).toLocaleDateString()} - {weekEnd.toLocaleDateString()}
                            </span>
                            <span className="font-bold" style={{ color: '#9D2235' }}>
                              {count} visits
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="h-3 rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: '#9D2235'
                              }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Recent Visits */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: '#9D2235' }}>
                  Recent Visits
                </h2>

                {visits.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No visits in this time period</p>
                ) : (
                  <div className="space-y-3">
                    {visits.slice(0, 20).map(visit => (
                      <div
                        key={visit.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-[#9D2235] transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-lg">
                              {visit.agencies?.name || 'Unknown Agency'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {visit.agencies?.city}, {visit.agencies?.state}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {parseLocalDate(visit.visit_date).toLocaleDateString()}
                          </div>
                        </div>

                        {visit.conversation_notes && (
                          <div className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded">
                            {visit.conversation_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </AppShell>
  )
}
