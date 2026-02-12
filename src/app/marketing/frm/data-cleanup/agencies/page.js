'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { findDuplicateAgencies, getDuplicateStats, suggestKeepAgency } from '@/lib/services/frm/agencyMatcher'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function AgencyDuplicateTool() {
  const [duplicateGroups, setDuplicateGroups] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [keepAgencyId, setKeepAgencyId] = useState(null)
  const [merging, setMerging] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    scanForDuplicates()
  }, [])

  async function scanForDuplicates() {
    setScanning(true)
    setLoading(true)
    try {
      // Fetch all agencies
      const { data: agencies, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name')

      if (error) throw error

      // Find duplicates
      const groups = findDuplicateAgencies(agencies || [])
      setDuplicateGroups(groups)

      // Calculate stats
      const statistics = getDuplicateStats(groups)
      setStats(statistics)

      if (groups.length === 0) {
        toast.success('No duplicates found!')
      } else {
        toast.success(`Found ${groups.length} potential duplicate groups`)
      }
    } catch (err) {
      console.error('Error scanning for duplicates:', err)
      toast.error('Failed to scan for duplicates')
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }

  function openMergeModal(group) {
    setSelectedGroup(group)
    // Suggest which agency to keep
    const suggested = suggestKeepAgency(group.agencies)
    setKeepAgencyId(suggested.id)
  }

  async function markAsSeparateLocations() {
    if (!selectedGroup) return

    try {
      setMerging(true)

      // Update each agency with a location number
      for (let i = 0; i < selectedGroup.agencies.length; i++) {
        const agency = selectedGroup.agencies[i]
        const locationNum = i + 1

        const { error } = await supabase
          .from('agencies')
          .update({
            location_number: locationNum,
            name: `${agency.name} (Location ${locationNum})`
          })
          .eq('id', agency.id)

        if (error) throw error
      }

      toast.success(`✓ Marked ${selectedGroup.agencies.length} agencies as separate locations`)
      closeMergeModal()
      scanForDuplicates()
    } catch (err) {
      console.error('Error marking locations:', err)
      toast.error('Failed to mark as separate locations: ' + err.message)
    } finally {
      setMerging(false)
    }
  }

  function closeMergeModal() {
    setSelectedGroup(null)
    setKeepAgencyId(null)
  }

  async function mergeAgencies() {
    if (!keepAgencyId || !selectedGroup) return

    if (!confirm(`This will merge ${selectedGroup.count} agencies into one. This cannot be undone. Continue?`)) {
      return
    }

    setMerging(true)
    try {
      const keepAgency = selectedGroup.agencies.find(a => a.id === keepAgencyId)
      const mergeAgencies = selectedGroup.agencies.filter(a => a.id !== keepAgencyId)
      const mergeIds = mergeAgencies.map(a => a.id)

      const { data: { user } } = await supabase.auth.getUser()

      // 1. Record the merge in history
      const { error: historyError } = await supabase
        .from('agency_merge_history')
        .insert({
          kept_agency_id: keepAgencyId,
          merged_agency_ids: mergeIds,
          merged_data: mergeAgencies,
          reason: selectedGroup.reasons.join('; '),
          merged_by: user.id
        })

      if (historyError) throw historyError

      // 2. Update all visits to point to kept agency
      const { error: visitsError } = await supabase
        .from('visits')
        .update({ agency_id: keepAgencyId })
        .in('agency_id', mergeIds)

      if (visitsError) throw visitsError

      // 3. Update all contacts to point to kept agency
      const { error: contactsError } = await supabase
        .from('agency_contacts')
        .update({ agency_id: keepAgencyId })
        .in('agency_id', mergeIds)

      if (contactsError) throw contactsError

      // 4. Update zone assignments to point to kept agency
      const { error: zonesError } = await supabase
        .from('zone_assignments')
        .update({ agency_id: keepAgencyId })
        .in('agency_id', mergeIds)

      if (zonesError) throw zonesError

      // 5. Delete the merged agencies
      const { error: deleteError } = await supabase
        .from('agencies')
        .delete()
        .in('id', mergeIds)

      if (deleteError) throw deleteError

      toast.success(`✓ Successfully merged ${mergeAgencies.length} agencies into "${keepAgency.name}"`)
      closeMergeModal()
      scanForDuplicates()
    } catch (err) {
      console.error('Error merging agencies:', err)
      toast.error('Failed to merge agencies: ' + err.message)
    } finally {
      setMerging(false)
    }
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#9D2235' }}>
                Agency Duplicate Detection
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Find and merge duplicate agency records
              </p>
            </div>
            <button
              onClick={scanForDuplicates}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {scanning ? 'Scanning...' : 'Rescan'}
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.totalGroups}</div>
                <div className="text-sm text-gray-600">Duplicate Groups</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalDuplicates}</div>
                <div className="text-sm text-gray-600">Total Duplicates</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.largestGroup}</div>
                <div className="text-sm text-gray-600">Largest Group</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-green-600">{stats.avgGroupSize}</div>
                <div className="text-sm text-gray-600">Avg Group Size</div>
              </div>
            </div>
          )}

          {/* Duplicate Groups */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Potential Duplicates</h2>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Scanning for duplicates...</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  🎉 No duplicate agencies found!
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-lg mb-1">
                            Group {idx + 1}: {group.count} duplicates
                          </div>
                          <div className="text-sm text-gray-600">
                            {group.reasons.slice(0, 2).map((reason, i) => (
                              <div key={i} className="text-xs">• {reason}</div>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => openMergeModal(group)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        >
                          Review & Merge
                        </button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 mt-3">
                        {group.agencies.slice(0, 4).map(agency => (
                          <div key={agency.id} className="bg-gray-50 p-3 rounded text-sm">
                            <div className="font-medium">{agency.name}</div>
                            <div className="text-xs text-gray-600">
                              {agency.address && <div>📍 {agency.address}</div>}
                              <div>{agency.city}, {agency.state} {agency.zip}</div>
                              {agency.phone && <div>📞 {agency.phone}</div>}
                            </div>
                          </div>
                        ))}
                        {group.agencies.length > 4 && (
                          <div className="bg-gray-100 p-3 rounded text-sm text-center text-gray-500">
                            +{group.agencies.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-blue-900 mb-2">How duplicate detection works:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Exact name match:</strong> Same agency name (ignoring punctuation/case)</li>
              <li><strong>Same address:</strong> Identical street address and city</li>
              <li><strong>Same phone:</strong> Identical phone number</li>
              <li><strong>Close proximity:</strong> Within 50 meters with similar names</li>
            </ul>
          </div>
        </div>

        {/* Merge Modal */}
        {selectedGroup && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={closeMergeModal}
            />
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold">Merge Duplicate Agencies</h2>
                      <button
                        onClick={closeMergeModal}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Select which agency to keep. All visits, contacts, and zone assignments will be transferred.
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {selectedGroup.agencies.map(agency => {
                        const isKeep = agency.id === keepAgencyId
                        return (
                          <div
                            key={agency.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                              isKeep
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                            onClick={() => setKeepAgencyId(agency.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    isKeep ? 'border-green-500 bg-green-500' : 'border-gray-300'
                                  }`}>
                                    {isKeep && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="font-semibold text-lg">{agency.name}</div>
                                  {isKeep && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                      Keep
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 space-y-1 ml-7">
                                  {agency.address && <div>📍 {agency.address}</div>}
                                  <div>{agency.city}, {agency.state} {agency.zip}</div>
                                  {agency.phone && <div>📞 {agency.phone}</div>}
                                  {agency.website && <div>🌐 {agency.website}</div>}
                                  {agency.rating && (
                                    <div>⭐ {agency.rating} ({agency.ratingCount} reviews)</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="text-sm text-yellow-800">
                          <strong>Warning:</strong> The agencies not selected will be permanently deleted.
                          All their visits, contacts, and zone assignments will be transferred to the kept agency.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t bg-gray-50">
                    <div className="flex gap-3 justify-between">
                      <button
                        onClick={markAsSeparateLocations}
                        disabled={merging}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        Keep Both - Different Locations
                      </button>
                      <div className="flex gap-3">
                        <button
                          onClick={closeMergeModal}
                          disabled={merging}
                          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={mergeAgencies}
                          disabled={!keepAgencyId || merging}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {merging ? 'Merging...' : `Merge ${selectedGroup.count - 1} into Selected`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </AppShell>
  )
}
