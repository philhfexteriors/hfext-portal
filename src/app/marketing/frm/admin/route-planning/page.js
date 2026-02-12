'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { isAdmin as checkAdmin } from '@/lib/frm/auth/roles'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function RoutePlanningPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [currentOptimization, setCurrentOptimization] = useState(null)
  const [zones, setZones] = useState([])
  const [frmGroups, setFrmGroups] = useState([])
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [editingZoneName, setEditingZoneName] = useState('')

  // Check admin access
  useEffect(() => {
    if (user && !checkAdmin(user.email)) {
      toast.error('Admin access required')
      router.push('/marketing/frm')
    }
  }, [user, router])

  // Fetch current optimization status
  const fetchOptimizationStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/optimize-routes')
      if (!response.ok) {
        throw new Error('Failed to fetch optimization status')
      }
      const data = await response.json()
      setCurrentOptimization(data)
      if (data.zones) {
        setZones(data.zones)
      }
      if (data.frmGroups) {
        setFrmGroups(data.frmGroups)
      }
    } catch (error) {
      console.error('Error fetching optimization status:', error)
      toast.error('Failed to load optimization status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOptimizationStatus()
  }, [])

  const [inactiveCount, setInactiveCount] = useState(0)
  const supabase = createClient()

  // Fetch inactive agency count
  useEffect(() => {
    async function fetchInactiveCount() {
      const { count, error } = await supabase
        .from('agencies')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)

      if (!error && count !== null) {
        setInactiveCount(count)
      }
    }
    fetchInactiveCount()
  }, [])

  // Update zone custom name
  async function updateZoneName(zoneId, zoneName) {
    try {
      const { error } = await supabase
        .from('route_zones')
        .update({ custom_name: editingZoneName || null })
        .eq('id', zoneId)

      if (error) throw error

      toast.success('Zone name updated!')
      setEditingZoneId(null)
      setEditingZoneName('')
      fetchOptimizationStatus()
    } catch (err) {
      console.error('Error updating zone:', err)
      toast.error('Failed to update zone name')
    }
  }

  // Trigger route optimization
  const triggerOptimization = async () => {
    if (!confirm('This will create a new route optimization with 11 zones. Continue?')) {
      return
    }

    setOptimizing(true)
    toast.loading('Optimizing routes... This may take a minute.')

    try {
      const response = await fetch('/api/admin/optimize-routes', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Optimization failed')
      }

      const result = await response.json()

      toast.dismiss()
      toast.success(`Created ${result.stats.zonesCreated} zones with ${result.stats.totalAgencies} agencies!`)

      // Refresh the page data
      await fetchOptimizationStatus()

    } catch (error) {
      toast.dismiss()
      console.error('Optimization error:', error)
      toast.error(`Optimization failed: ${error.message}`)
    } finally {
      setOptimizing(false)
    }
  }

  if (loading) {
    return (
      <AppShell fullWidth>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell fullWidth>
      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Route Planning & Optimization</h1>
            <p className="text-gray-600">
              11 zones, 17 agencies per day, 85+ per week
            </p>
          </div>

          {/* Current Optimization Overview */}
          {currentOptimization?.hasOptimization ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-white p-5 rounded-lg shadow">
                  <div className="text-3xl font-bold text-blue-600">
                    {currentOptimization.stats.totalAgencies}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Agencies</div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow">
                  <div className="text-3xl font-bold text-green-600">
                    {currentOptimization.stats.totalZones}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Zones</div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow">
                  <div className="text-3xl font-bold text-purple-600">85+</div>
                  <div className="text-sm text-gray-600 mt-1">Per Week Min</div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow">
                  <div className="text-3xl font-bold text-orange-600">17</div>
                  <div className="text-sm text-gray-600 mt-1">Per Day</div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow">
                  <div className="text-3xl font-bold text-gray-600">v{currentOptimization.currentVersion}</div>
                  <div className="text-sm text-gray-600 mt-1">Version</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(currentOptimization.optimizedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {inactiveCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-8 flex items-center gap-3">
                  <span className="text-yellow-600 text-xl">⚠️</span>
                  <div className="text-sm text-yellow-800">
                    <strong>{inactiveCount} inactive {inactiveCount === 1 ? 'agency' : 'agencies'}</strong> excluded from route optimization.
                    Manage inactive agencies from the <a href="/marketing/frm/agency-lookup" className="underline font-medium hover:text-yellow-900">Agency Lookup</a> page.
                  </div>
                </div>
              )}

              {currentOptimization.stats.notes && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-8">
                  <div className="text-sm text-blue-800">
                    {currentOptimization.stats.notes}
                  </div>
                </div>
              )}

              {/* FRM Sections */}
              {frmGroups.map(frm => (
                <div key={frm.frmNumber} className="bg-white p-6 rounded-lg shadow mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{frm.frmName}</h2>
                    <div className="text-sm text-gray-600">
                      {frm.totalAgencies} agencies across {frm.zones.length} zones
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {frm.zones.map(zone => {
                      // Find zone stats from zone_stats
                      const zoneStat = currentOptimization.stats.zoneStats?.find(
                        z => z.zoneName === zone.zone_name || z.zoneNumber === zone.zone_number
                      )

                      return (
                        <div
                          key={zone.id}
                          className="border border-gray-200 p-4 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              {editingZoneId === zone.id ? (
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={editingZoneName}
                                    onChange={(e) => setEditingZoneName(e.target.value)}
                                    placeholder="Enter custom name"
                                    className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => updateZoneName(zone.id, zone.zone_name)}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingZoneId(null)
                                      setEditingZoneName('')
                                    }}
                                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-lg">{zone.zone_name}</h3>
                                  {zone.custom_name && (
                                    <span className="text-sm text-gray-600">- {zone.custom_name}</span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingZoneId(zone.id)
                                      setEditingZoneName(zone.custom_name || '')
                                    }}
                                    className="text-gray-400 hover:text-blue-600 text-xs"
                                    title="Edit zone name"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-2xl font-bold text-blue-600 ml-2">
                              {zone.agencyCount || 0}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            17 agencies/day, 5 days
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Zone Stats Table */}
              {currentOptimization.stats.zoneStats && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h2 className="text-xl font-bold mb-4">Zone Details</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4">Zone</th>
                          <th className="pb-2 pr-4">Agencies</th>
                          <th className="pb-2 pr-4">Schedule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentOptimization.stats.zoneStats.map((zone, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-medium">{zone.zoneName}</td>
                            <td className="py-2 pr-4">{zone.totalAgencies}</td>
                            <td className="py-2 pr-4">17/day, Mon-Fri</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No Optimization Yet */
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <h2 className="text-xl font-bold mb-4">No Optimization Found</h2>
              <p className="text-gray-600 mb-6">
                No route optimization has been run yet. Click below to create the initial optimization
                with 11 balanced zones (85+ agencies each).
              </p>
            </div>
          )}

          {/* Optimization Controls */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Run Optimization</h2>
            <p className="text-gray-600 mb-6">
              Groups all geocoded agencies into 11 balanced geographic zones
              with 85+ agencies each. Each zone is visited at 17 agencies per day.
            </p>

            <button
              onClick={triggerOptimization}
              disabled={optimizing}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {optimizing ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Optimizing Routes...
                </span>
              ) : currentOptimization?.hasOptimization ? (
                'Re-Optimize Routes'
              ) : (
                'Create Initial Optimization'
              )}
            </button>

            <div className="mt-4 text-sm text-gray-500 space-y-1">
              {currentOptimization?.hasOptimization && (
                <p>
                  This will create version v{currentOptimization.currentVersion + 1}.
                  Previous assignments are preserved.
                </p>
              )}
              <p><strong>Algorithm:</strong> Geographic sort with nearest-neighbor route ordering</p>
              <p><strong>Config:</strong> 11 zones, 85+ agencies each, 17 visits/day</p>
              {currentOptimization?.stats?.executionTimeMs && (
                <p><strong>Last run:</strong> {Math.round(currentOptimization.stats.executionTimeMs / 1000)}s</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
