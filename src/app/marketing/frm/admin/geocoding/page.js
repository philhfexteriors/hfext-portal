'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { isAdmin as checkAdmin } from '@/lib/frm/auth/roles'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function GeocodingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [ungeocoded, setUngeocoded] = useState([])

  // Check admin access
  useEffect(() => {
    if (user && !checkAdmin(user.email)) {
      toast.error('Admin access required')
      router.push('/marketing/frm')
    }
  }, [user, router])

  // Fetch geocoding status
  const fetchStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/geocode-batch')
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStats(data)
      setUngeocoded(data.ungeocodedAgencies || [])
    } catch (error) {
      console.error('Error fetching status:', error)
      toast.error('Failed to load geocoding status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Start batch geocoding
  const startBatchGeocoding = async () => {
    if (!confirm(`Start batch geocoding for ${stats?.ungecoded || 0} agencies?`)) {
      return
    }

    setProcessing(true)
    setProgress({ current: 0, total: stats?.ungecoded || 0, succeeded: 0, failed: 0 })

    try {
      const response = await fetch('/api/admin/geocode-batch', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Batch geocoding failed')
      }

      const result = await response.json()

      setProgress({
        current: result.processed,
        total: result.processed,
        succeeded: result.succeeded,
        failed: result.failed
      })

      if (result.succeeded > 0) {
        toast.success(`Successfully geocoded ${result.succeeded} agencies`)
      }

      if (result.failed > 0) {
        toast.error(`Failed to geocode ${result.failed} agencies`)
      }

      // Refresh status
      await fetchStatus()

    } catch (error) {
      console.error('Batch geocoding error:', error)
      toast.error('Batch geocoding failed')
    } finally {
      setProcessing(false)
    }
  }

  // Retry failed agency
  const retryAgency = async (agencyId) => {
    toast.loading('Retrying geocoding...')

    try {
      const response = await fetch('/api/admin/geocode-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyIds: [agencyId] })
      })

      if (!response.ok) {
        throw new Error('Retry failed')
      }

      toast.dismiss()
      toast.success('Agency geocoded successfully')
      await fetchStatus()

    } catch (error) {
      toast.dismiss()
      toast.error('Retry failed')
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

  const percentageGeocoded = stats?.total > 0
    ? Math.round((stats.geocoded / stats.total) * 100)
    : 0

  return (
    <AppShell fullWidth>
      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Agency Geocoding</h1>
            <p className="text-gray-600">
              Geocode agencies to enable route optimization and mapping features
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-3xl font-bold text-blue-600">{stats?.total || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Total Agencies</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-3xl font-bold text-green-600">{stats?.geocoded || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Geocoded</div>
              <div className="text-xs text-gray-500 mt-1">{percentageGeocoded}% complete</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-3xl font-bold text-orange-600">{stats?.ungecoded || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Pending</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-3xl font-bold text-red-600">{stats?.failed || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Failed</div>
            </div>
          </div>

          {/* Progress Bar */}
          {stats && stats.total > 0 && (
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">{percentageGeocoded}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${percentageGeocoded}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Batch Geocoding Control */}
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-bold mb-4">Batch Geocoding</h2>

            {processing && progress ? (
              <div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Processing Agencies</span>
                    <span className="text-sm text-gray-600">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">✓ Succeeded:</span> {progress.succeeded}
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">✗ Failed:</span> {progress.failed}
                  </div>
                </div>

                <div className="mt-4 flex items-center text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Processing... This may take several minutes.
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Geocode all pending agencies using the Geocodio API. This will add latitude and longitude coordinates to enable route optimization.
                </p>

                <button
                  onClick={startBatchGeocoding}
                  disabled={processing || (stats?.ungecoded || 0) === 0}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(stats?.ungecoded || 0) === 0
                    ? 'All Agencies Geocoded'
                    : `Start Batch Geocoding (${stats?.ungecoded || 0} agencies)`}
                </button>

                <p className="text-xs text-gray-500 mt-2">
                  Rate limited to 1 request per second. Estimated time: ~{Math.ceil((stats?.ungecoded || 0) / 60)} minutes
                </p>
              </>
            )}
          </div>

          {/* Ungecoded Agencies List */}
          {ungeocoded.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">
                Pending Agencies ({ungeocoded.length > 100 ? '100+' : ungeocoded.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3">Agency</th>
                      <th className="text-left p-3">Address</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ungeocoded.map(agency => (
                      <tr key={agency.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{agency.name}</td>
                        <td className="p-3 text-gray-600">
                          {agency.address || 'No address'}, {agency.city}, {agency.state} {agency.zip}
                        </td>
                        <td className="p-3">
                          {agency.geocode_error ? (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                              Error: {agency.geocode_error}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {agency.geocode_error && (
                            <button
                              onClick={() => retryAgency(agency.id)}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ungeocoded.length >= 100 && (
                <p className="text-sm text-gray-500 mt-4">
                  Showing first 100 agencies. Run batch geocoding to process all.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
