'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function PhoneLookup() {
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [preview, setPreview] = useState([])
  const batchSize = 10
  const supabase = createClient()

  useEffect(() => {
    loadAgenciesWithoutPhones()
  }, [])

  async function loadAgenciesWithoutPhones() {
    try {
      // Load agencies that don't have phone numbers
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .or('phone.is.null,phone.eq.')
        .not('address', 'is', null)
        .order('name')

      if (error) throw error

      console.log('Loaded agencies without phones:', data.length)
      setAgencies(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading agencies:', error)
      toast.error('Failed to load agencies')
      setLoading(false)
    }
  }

  async function lookupPhone(agency) {
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agency.name,
          address: agency.address,
          city: agency.city,
          state: agency.state,
          zip: agency.zip
        })
      })

      const data = await response.json()

      if (data.success) {
        return {
          success: true,
          phone: data.phone,
          website: data.website,
          rating: data.rating,
          ratingCount: data.ratingCount,
          businessStatus: data.businessStatus,
          formattedAddress: data.address
        }
      }

      return { success: false, error: data.error }
    } catch (error) {
      console.error('Phone lookup error:', error)
      return { success: false, error: error.message }
    }
  }

  async function lookupBatch() {
    const startIdx = currentBatch * batchSize
    const endIdx = Math.min(startIdx + batchSize, agencies.length)
    const batchAgencies = agencies.slice(startIdx, endIdx)

    setProcessing(true)
    toast.loading(`Looking up phones for batch ${currentBatch + 1}...`, { id: 'lookup' })

    const results = []

    for (let i = 0; i < batchAgencies.length; i++) {
      const agency = batchAgencies[i]
      console.log(`Looking up ${i + 1}/${batchAgencies.length}: ${agency.name}`)

      const result = await lookupPhone(agency)

      results.push({
        ...agency,
        lookupResult: result
      })

      // Rate limit: 1 request per second
      if (i < batchAgencies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setPreview(results)
    setProcessing(false)
    toast.success('Phone lookup complete!', { id: 'lookup' })
  }

  async function applyPhonesBatch() {
    const agenciesToUpdate = preview.filter(a => a.lookupResult?.success && a.lookupResult.phone)

    if (agenciesToUpdate.length === 0) {
      toast.error('No phone numbers found to update')
      return
    }

    setProcessing(true)

    let successCount = 0
    let failCount = 0

    try {
      toast.loading(`Updating 0/${agenciesToUpdate.length} agencies...`, { id: 'applying' })

      for (let i = 0; i < agenciesToUpdate.length; i++) {
        const agency = agenciesToUpdate[i]
        const result = agency.lookupResult

        const updates = {
          phone: result.phone,
          website: result.website || agency.website
        }

        console.log(`Updating ${agency.name}:`, updates)

        const { error } = await supabase
          .from('agencies')
          .update(updates)
          .eq('id', agency.id)

        if (error) {
          console.error(`Failed to update ${agency.name}:`, error)
          failCount++
        } else {
          successCount++
        }

        toast.loading(`Updated ${i + 1}/${agenciesToUpdate.length} agencies...`, { id: 'applying' })
      }

      toast.success(`Updated ${successCount} agencies successfully!`, { id: 'applying' })
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} agencies`)
      }

      // Reload data
      await loadAgenciesWithoutPhones()
      setPreview([])

    } catch (error) {
      console.error('Error applying phone numbers:', error)
      toast.error('Failed to update phone numbers')
    } finally {
      setProcessing(false)
    }
  }

  const totalPages = Math.ceil(agencies.length / batchSize)
  const startIdx = currentBatch * batchSize
  const endIdx = Math.min(startIdx + batchSize, agencies.length)
  const currentAgencies = agencies.slice(startIdx, endIdx)
  const displayAgencies = preview.length > 0 ? preview : currentAgencies

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
      <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-6">Phone Number Lookup</h1>

          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Agencies Without Phones</div>
                <div className="text-2xl font-bold">{agencies.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Current Batch</div>
                <div className="text-2xl font-bold">{currentBatch + 1} / {totalPages}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Found This Batch</div>
                <div className="text-2xl font-bold text-green-600">
                  {preview.filter(a => a.lookupResult?.success && a.lookupResult.phone).length}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex gap-4 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentBatch(Math.max(0, currentBatch - 1))}
                  disabled={currentBatch === 0 || processing}
                  className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setCurrentBatch(Math.min(totalPages - 1, currentBatch + 1))}
                  disabled={currentBatch >= totalPages - 1 || processing}
                  className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={lookupBatch}
                  disabled={processing || currentAgencies.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Looking up...' : 'Lookup Current Batch'}
                </button>

                {preview.length > 0 && (
                  <button
                    onClick={applyPhonesBatch}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply to Current Batch
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          {agencies.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">
                🎉 All agencies have phone numbers!
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Found Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Website</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayAgencies.map((agency) => {
                    const result = agency.lookupResult
                    const hasChanges = result?.success

                    return (
                      <tr key={agency.id} className={hasChanges ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{agency.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {agency.city}, {agency.state} {agency.zip}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {agency.phone || <span className="text-red-500">(empty)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {result ? (
                            result.success && result.phone ? (
                              <div className="text-sm font-medium text-green-600">
                                {result.phone}
                              </div>
                            ) : (
                              <div className="text-sm text-red-500">Not found</div>
                            )
                          ) : (
                            <div className="text-sm text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {result?.website && (
                            <a
                              href={result.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate block max-w-xs"
                            >
                              {result.website}
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {result ? (
                            result.success ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                ✓ Ready
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                Failed
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </AppShell>
  )
}
