'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { validateAgencyAddress, getValidationStats } from '@/lib/services/frm/addressValidator'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function AddressCleanup() {
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, incomplete, out_of_territory, suspicious
  const [validating, setValidating] = useState(false)
  const [stats, setStats] = useState(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchAgenciesNeedingReview()
  }, [filter])

  async function fetchAgenciesNeedingReview() {
    setLoading(true)
    try {
      let query = supabase
        .from('agencies')
        .select('*')

      if (filter === 'all') {
        query = query.eq('address_needs_review', true)
      } else {
        query = query.eq('address_validation_status', filter)
      }

      const { data, error } = await query.order('name')

      if (error) {
        // Check if error is due to missing columns (migration not run)
        if (error.message && (error.message.includes('address_needs_review') || error.message.includes('address_validation_status') || error.code === '42703')) {
          setMigrationNeeded(true)
          toast.error('Database migration required. See the banner above for instructions.')
          setAgencies([])
          setStats({ total: 0, valid: 0, incomplete: 0, out_of_territory: 0, suspicious: 0, needs_review: 0 })
          setLoading(false)
          return
        }
        throw error
      }

      setAgencies(data || [])

      // Calculate stats
      if (data) {
        const validationResults = data.map(agency => ({
          id: agency.id,
          validation: {
            status: agency.address_validation_status,
            needsReview: agency.address_needs_review
          }
        }))
        setStats(getValidationStats(validationResults))
      }
    } catch (err) {
      console.error('Error loading agencies:', err)
      toast.error('Failed to load agencies: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  async function runValidation() {
    if (!confirm('This will validate all agencies in the database. Continue?')) {
      return
    }

    setValidating(true)
    try {
      // Fetch all agencies
      const { data: allAgencies, error: fetchError } = await supabase
        .from('agencies')
        .select('*')

      if (fetchError) throw fetchError

      let updateCount = 0
      let errorCount = 0

      // Process in batches of 50 to avoid overwhelming the database
      const batchSize = 50
      for (let i = 0; i < allAgencies.length; i += batchSize) {
        const batch = allAgencies.slice(i, i + batchSize)

        for (const agency of batch) {
          const validation = validateAgencyAddress(agency)

          const { error } = await supabase
            .from('agencies')
            .update({
              address_validation_status: validation.status,
              address_needs_review: validation.needsReview,
              address_validation_notes: validation.notes.join('; '),
              address_validation_date: new Date().toISOString()
            })
            .eq('id', agency.id)

          if (error) {
            console.error(`Error updating agency ${agency.id}:`, error)
            errorCount++
          } else {
            updateCount++
          }
        }

        // Show progress
        toast.success(`Validated ${Math.min(i + batchSize, allAgencies.length)} / ${allAgencies.length} agencies`)
      }

      toast.success(`✓ Validation complete: ${updateCount} agencies updated${errorCount > 0 ? `, ${errorCount} errors` : ''}`)
      fetchAgenciesNeedingReview()
    } catch (err) {
      console.error('Error running validation:', err)
      toast.error('Failed to run validation')
    } finally {
      setValidating(false)
    }
  }

  async function markAsResolved(agencyId) {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          address_needs_review: false,
          address_validation_status: 'valid',
          address_validation_date: new Date().toISOString()
        })
        .eq('id', agencyId)

      if (error) throw error

      toast.success('Marked as resolved')
      fetchAgenciesNeedingReview()
    } catch (err) {
      console.error('Error marking as resolved:', err)
      toast.error('Failed to mark as resolved')
    }
  }

  function viewAgency(agencyId, agencyName) {
    router.push(`/agency-lookup?agencyId=${agencyId}&agencyName=${encodeURIComponent(agencyName)}`)
  }

  async function toggleAgencyActive(agencyId, currentlyActive) {
    const newStatus = !currentlyActive
    const action = newStatus ? 'reactivate' : 'deactivate'
    if (!confirm(`Are you sure you want to ${action} this agency? ${!newStatus ? 'It will be removed from route planning.' : ''}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('agencies')
        .update({ is_active: newStatus })
        .eq('id', agencyId)

      if (error) throw error

      toast.success(`Agency ${newStatus ? 'reactivated' : 'deactivated'}`)
      fetchAgenciesNeedingReview()
    } catch (err) {
      console.error('Error toggling agency status:', err)
      toast.error('Failed to update agency status')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'incomplete':
        return 'bg-yellow-100 text-yellow-800'
      case 'out_of_territory':
        return 'bg-red-100 text-red-800'
      case 'suspicious':
        return 'bg-orange-100 text-orange-800'
      case 'valid':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'incomplete':
        return 'Incomplete'
      case 'out_of_territory':
        return 'Out of Territory'
      case 'suspicious':
        return 'Suspicious'
      case 'valid':
        return 'Valid'
      case 'unvalidated':
        return 'Unvalidated'
      default:
        return status
    }
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#9D2235' }}>
                Address Validation
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Review and fix problematic addresses
              </p>
            </div>
            <button
              onClick={runValidation}
              disabled={validating || migrationNeeded}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {validating ? 'Validating...' : 'Run Validation'}
            </button>
          </div>

          {/* Migration Required Banner */}
          {migrationNeeded && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 text-lg mb-2">Database Migration Required</h3>
                  <p className="text-red-800 mb-4">
                    This feature requires new database columns. Please run the migration SQL in Supabase:
                  </p>
                  <div className="bg-white border border-red-300 rounded p-3 mb-3">
                    <ol className="text-sm text-gray-800 space-y-2 list-decimal list-inside">
                      <li>Go to your <strong>Supabase Dashboard</strong></li>
                      <li>Click <strong>SQL Editor</strong> in the left sidebar</li>
                      <li>Click <strong>New Query</strong></li>
                      <li>Copy the SQL from: <code className="bg-gray-100 px-2 py-1 rounded text-xs">migrations/address-validation-flags.sql</code></li>
                      <li>Paste it into the query editor</li>
                      <li>Click <strong>Run</strong></li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-red-700 font-medium hover:text-red-900">Show SQL Code</summary>
                    <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
{`-- Add validation flags to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS address_validation_status TEXT DEFAULT 'unvalidated',
ADD COLUMN IF NOT EXISTS address_validation_notes TEXT,
ADD COLUMN IF NOT EXISTS address_needs_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS address_validation_date TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agencies_needs_review
ON agencies(address_needs_review) WHERE address_needs_review = true;

CREATE INDEX IF NOT EXISTS idx_agencies_validation_status
ON agencies(address_validation_status);`}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.needs_review || 0}</div>
                <div className="text-xs text-gray-600">Needs Review</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg shadow text-center">
                <div className="text-2xl font-bold text-yellow-800">{stats.incomplete || 0}</div>
                <div className="text-xs text-gray-600">Incomplete</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg shadow text-center">
                <div className="text-2xl font-bold text-red-800">{stats.out_of_territory || 0}</div>
                <div className="text-xs text-gray-600">Out of Territory</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg shadow text-center">
                <div className="text-2xl font-bold text-orange-800">{stats.suspicious || 0}</div>
                <div className="text-xs text-gray-600">Suspicious</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg shadow text-center">
                <div className="text-2xl font-bold text-green-800">{stats.valid || 0}</div>
                <div className="text-xs text-gray-600">Valid</div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex gap-2 p-2 border-b flex-wrap">
              {[
                { key: 'all', label: 'All Issues' },
                { key: 'incomplete', label: 'Incomplete' },
                { key: 'out_of_territory', label: 'Out of Territory' },
                { key: 'suspicious', label: 'Suspicious' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded font-medium transition ${
                    filter === tab.key
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Agency List */}
            <div className="p-4">
              {loading ? (
                <div className="text-center py-12">
                  <Loading />
                  <p className="text-gray-500 mt-4">Loading agencies...</p>
                </div>
              ) : agencies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {filter === 'all'
                    ? '🎉 No agencies need review!'
                    : `No agencies with status "${getStatusLabel(filter)}"`}
                </div>
              ) : (
                <div className="space-y-3">
                  {agencies.map(agency => (
                    <div key={agency.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`font-semibold text-lg ${agency.is_active === false ? 'text-gray-400 line-through' : ''}`}>{agency.name}</h3>
                            {agency.is_active === false && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>📍 {agency.address || '(no address)'}</div>
                            <div className="ml-4">{agency.city || '(no city)'}, {agency.state || '(no state)'} {agency.zip || '(no zip)'}</div>
                            {agency.phone && <div>📞 {agency.phone}</div>}
                          </div>
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(agency.address_validation_status)}`}>
                              {getStatusLabel(agency.address_validation_status)}
                            </span>
                            {agency.address_validation_date && (
                              <span className="text-xs text-gray-500">
                                Checked: {new Date(agency.address_validation_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {agency.address_validation_notes && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              {agency.address_validation_notes}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={() => viewAgency(agency.id, agency.name)}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition whitespace-nowrap"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => markAsResolved(agency.id)}
                            className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition whitespace-nowrap"
                          >
                            Mark Resolved
                          </button>
                          <button
                            onClick={() => toggleAgencyActive(agency.id, agency.is_active !== false)}
                            className={`px-3 py-1.5 text-sm rounded transition whitespace-nowrap ${
                              agency.is_active === false
                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {agency.is_active === false ? 'Reactivate' : 'Deactivate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to use this tool:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Run Validation:</strong> Analyzes all agencies and flags issues</li>
              <li><strong>View Details:</strong> Opens the agency in Agency Lookup for editing</li>
              <li><strong>Mark Resolved:</strong> Confirms the address is correct and removes from review list</li>
              <li><strong>Validation checks:</strong> Missing fields, suspicious patterns, out-of-territory states, invalid ZIP codes</li>
            </ul>
          </div>
        </div>
    </AppShell>
  )
}
