'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { findAgenciesWithDuplicates, getDuplicateStats, suggestKeepContact } from '@/lib/services/frm/contactMatcher'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function ContactMergeTool() {
  const [agencies, setAgencies] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [keepContactId, setKeepContactId] = useState(null)
  const [merging, setMerging] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    scanForDuplicates()
  }, [])

  async function scanForDuplicates() {
    setScanning(true)
    setLoading(true)
    try {
      // Fetch all agencies with their contacts
      const { data: agenciesData, error } = await supabase
        .from('agencies')
        .select(`
          *,
          agency_contacts (*)
        `)
        .order('name')

      if (error) throw error

      // Find agencies with duplicate contacts
      const withDuplicates = findAgenciesWithDuplicates(agenciesData || [])
      setAgencies(withDuplicates)

      // Calculate stats
      const statistics = getDuplicateStats(withDuplicates)
      setStats(statistics)

      if (withDuplicates.length === 0) {
        toast.success('No duplicate contacts found!')
      } else {
        toast.success(`Found duplicates in ${withDuplicates.length} agencies`)
      }
    } catch (err) {
      console.error('Error scanning for duplicates:', err)
      toast.error('Failed to scan for duplicates')
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }

  function openMergeModal(agency, group) {
    setSelectedAgency(agency)
    setSelectedGroup(group)
    // Suggest which contact to keep
    const suggested = suggestKeepContact(group.contacts)
    setKeepContactId(suggested.id)
  }

  function closeMergeModal() {
    setSelectedAgency(null)
    setSelectedGroup(null)
    setKeepContactId(null)
  }

  async function mergeContacts() {
    if (!keepContactId || !selectedGroup || !selectedAgency) return

    if (!confirm(`This will merge ${selectedGroup.count} contacts into one. This cannot be undone. Continue?`)) {
      return
    }

    setMerging(true)
    try {
      const keepContact = selectedGroup.contacts.find(c => c.id === keepContactId)
      const mergeContacts = selectedGroup.contacts.filter(c => c.id !== keepContactId)
      const mergeIds = mergeContacts.map(c => c.id)

      // Merge data (combine non-null fields from all contacts)
      const mergedData = { ...keepContact }
      mergeContacts.forEach(contact => {
        if (!mergedData.email && contact.email) mergedData.email = contact.email
        if (!mergedData.phone && contact.phone) mergedData.phone = contact.phone
        if (!mergedData.title && contact.title) mergedData.title = contact.title
      })

      // Update kept contact with merged data
      const { error: updateError } = await supabase
        .from('agency_contacts')
        .update({
          email: mergedData.email,
          phone: mergedData.phone,
          title: mergedData.title
        })
        .eq('id', keepContactId)

      if (updateError) throw updateError

      // Record merge history
      const { data: { user } } = await supabase.auth.getUser()
      const { error: historyError } = await supabase
        .from('contact_merge_history')
        .insert({
          agency_id: selectedAgency.id,
          kept_contact_id: keepContactId,
          merged_contact_ids: mergeIds,
          merged_data: mergeContacts,
          reason: selectedGroup.reasons.join('; '),
          merged_by: user.id
        })

      if (historyError) throw historyError

      // Delete the merged contacts
      const { error: deleteError } = await supabase
        .from('agency_contacts')
        .delete()
        .in('id', mergeIds)

      if (deleteError) throw deleteError

      toast.success(`✓ Successfully merged ${mergeContacts.length} contacts into "${keepContact.name}"`)
      closeMergeModal()
      scanForDuplicates()
    } catch (err) {
      console.error('Error merging contacts:', err)
      toast.error('Failed to merge contacts: ' + err.message)
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
                Contact Merge Tool
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Find and merge duplicate contacts within agencies
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
                <div className="text-3xl font-bold text-blue-600">{stats.totalAgenciesAffected}</div>
                <div className="text-sm text-gray-600">Agencies Affected</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalDuplicateGroups}</div>
                <div className="text-sm text-gray-600">Duplicate Groups</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-red-600">{stats.totalDuplicateContacts}</div>
                <div className="text-sm text-gray-600">Duplicate Contacts</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg shadow text-center">
                <div className="text-3xl font-bold text-green-600">{stats.avgDuplicatesPerAgency}</div>
                <div className="text-sm text-gray-600">Avg per Agency</div>
              </div>
            </div>
          )}

          {/* Agencies with duplicates */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Agencies with Duplicate Contacts</h2>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Scanning for duplicates...</p>
                </div>
              ) : agencies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  🎉 No duplicate contacts found!
                </div>
              ) : (
                <div className="space-y-4">
                  {agencies.map(agency => (
                    <div key={agency.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{agency.name}</h3>
                          <p className="text-sm text-gray-600">
                            {agency.city}, {agency.state}
                          </p>
                          <p className="text-sm text-orange-600 font-medium mt-1">
                            {agency.duplicateGroups.length} duplicate group(s) • {agency.totalDuplicates} total duplicates
                          </p>
                        </div>
                      </div>

                      {/* Duplicate groups for this agency */}
                      <div className="space-y-3 mt-3">
                        {agency.duplicateGroups.map((group, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-sm text-gray-700">
                                <strong>Group {idx + 1}:</strong> {group.count} contacts
                                <div className="text-xs text-gray-500 mt-1">
                                  {group.reasons.slice(0, 2).map((reason, i) => (
                                    <div key={i}>• {reason}</div>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => openMergeModal(agency, group)}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                              >
                                Review & Merge
                              </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-2 mt-2">
                              {group.contacts.map(contact => (
                                <div key={contact.id} className="bg-white p-2 rounded text-xs border">
                                  <div className="font-medium">{contact.name}</div>
                                  {contact.title && <div className="text-gray-600">{contact.title}</div>}
                                  {contact.email && <div className="text-blue-600">{contact.email}</div>}
                                  {contact.phone && <div className="text-gray-600">{contact.phone}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
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
              <li><strong>Same email:</strong> Exact match (case insensitive)</li>
              <li><strong>Same phone:</strong> Identical phone number</li>
              <li><strong>Similar name:</strong> 80%+ similarity using fuzzy matching (Levenshtein distance)</li>
              <li><strong>Partial name + domain:</strong> One name contains the other, with same email domain</li>
            </ul>
          </div>
        </div>

        {/* Merge Modal */}
        {selectedGroup && selectedAgency && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={closeMergeModal}
            />
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold">Merge Duplicate Contacts</h2>
                      <button
                        onClick={closeMergeModal}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Agency: <strong>{selectedAgency.name}</strong>
                    </p>
                    <p className="text-sm text-gray-600">
                      Select which contact to keep. Data from other contacts will be merged in.
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {selectedGroup.contacts.map(contact => {
                        const isKeep = contact.id === keepContactId
                        return (
                          <div
                            key={contact.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                              isKeep
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                            onClick={() => setKeepContactId(contact.id)}
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
                                  <div className="font-semibold text-lg">{contact.name}</div>
                                  {isKeep && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                      Keep
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 space-y-1 ml-7">
                                  {contact.title && <div><strong>Title:</strong> {contact.title}</div>}
                                  {contact.email && <div><strong>Email:</strong> {contact.email}</div>}
                                  {contact.phone && <div><strong>Phone:</strong> {contact.phone}</div>}
                                  {!contact.title && !contact.email && !contact.phone && (
                                    <div className="text-gray-400 italic">No additional details</div>
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
                          <strong>Note:</strong> Missing fields from other contacts will be added to the kept contact.
                          The contacts not selected will be permanently deleted.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t bg-gray-50">
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={closeMergeModal}
                        disabled={merging}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={mergeContacts}
                        disabled={!keepContactId || merging}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {merging ? 'Merging...' : `Merge ${selectedGroup.count - 1} into Selected`}
                      </button>
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
