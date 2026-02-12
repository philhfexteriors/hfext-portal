'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function DataCleanup() {
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [preview, setPreview] = useState([])
  const [testAddress, setTestAddress] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const batchSize = 10
  const supabase = createClient()

  useEffect(() => {
    loadAgenciesNeedingCleanup()
  }, [])

  async function loadAgenciesNeedingCleanup() {
    try {
      // Load ALL agencies with addresses to see what we're working with
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .not('address', 'is', null)
        .order('name')

      if (error) throw error

      console.log('Loaded agencies:', data.length)

      // Parse and preview the changes
      const parsedData = data.map(agency => {
        const parsed = parseAddress(agency.address)
        // Mark for cleanup if address contains city/state/zip OR if geocoded data would be different
        const needsCleanup = !agency.city || !agency.state || !agency.zip ||
                            agency.address.includes(',') // Address has commas, likely has city/state/zip in it
        return {
          ...agency,
          parsed,
          needsCleanup
        }
      })

      // Filter to only those that need cleanup
      const needingCleanup = parsedData.filter(a => a.needsCleanup)

      console.log('Agencies needing cleanup:', needingCleanup.length)
      console.log('First agency:', needingCleanup[0])

      setAgencies(needingCleanup)
      setCurrentBatch(0)
      setPreview(needingCleanup.slice(0, batchSize)) // Show first batch as preview
    } catch (error) {
      console.error('Error loading agencies:', error)
      toast.error('Failed to load agencies')
    } finally {
      setLoading(false)
    }
  }

  function parseAddress(fullAddress) {
    if (!fullAddress) return null

    // Common US address pattern: Street, City, ST ZIP
    // Examples:
    // "3021 Godfrey Rd #5233, Godfrey, IL 62035"
    // "123 Main St, Springfield, IL 62701"
    // "456 Oak Ave Suite 100, Chicago, IL 60601"

    // Regex to capture: everything before last comma = street, then city, state zip
    const pattern = /^(.+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i

    const match = fullAddress.trim().match(pattern)

    if (match) {
      return {
        street: match[1].trim(),
        city: match[2].trim(),
        state: match[3].toUpperCase(),
        zip: match[4].trim(),
        success: true
      }
    }

    // Alternative pattern: just "City, ST ZIP" at the end
    const simplePattern = /,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i
    const simpleMatch = fullAddress.trim().match(simplePattern)

    if (simpleMatch) {
      const street = fullAddress.substring(0, fullAddress.lastIndexOf(',')).trim()
      return {
        street: street,
        city: simpleMatch[1].trim(),
        state: simpleMatch[2].toUpperCase(),
        zip: simpleMatch[3].trim(),
        success: true
      }
    }

    return {
      success: false,
      original: fullAddress
    }
  }

  // Strip markdown links, URLs, and other non-address junk from a string
  function cleanAddress(raw) {
    if (!raw) return ''
    return raw
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // [text](url) → text
      .replace(/\(https?:\/\/[^)]*\)/g, '')        // (https://...) → remove
      .replace(/https?:\/\/\S+/g, '')              // bare URLs → remove
      .replace(/"[^"]*"/g, '')                      // "quoted junk" → remove
      .replace(/\s+/g, ' ')                         // collapse whitespace
      .trim()
  }

  async function geocodeAddress(address) {
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })

      const data = await response.json()

      if (data.success) {
        return {
          success: true,
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          formatted: data.formatted_address
        }
      }

      return { success: false, error: data.error }
    } catch (error) {
      console.error('Geocoding error:', error)
      return { success: false, error: error.message }
    }
  }

  async function testGeocode() {
    if (!testAddress.trim()) {
      toast.error('Please enter an address to test')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await geocodeAddress(testAddress)
      setTestResult(result)

      if (result.success) {
        toast.success('Geocoding successful!')
      } else {
        toast.error('Geocoding failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      toast.error('Test failed: ' + error.message)
    } finally {
      setTesting(false)
    }
  }

  async function geocodeBatch(batchIndex) {
    setGeocoding(true)
    let geocodedCount = 0
    let regexFallbackCount = 0

    try {
      const startTime = Date.now()
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, agencies.length)
      const batchToProcess = agencies.slice(start, end)

      toast.loading(`Geocoding batch ${batchIndex + 1} (${batchToProcess.length} addresses)...`, { id: 'geocoding' })

      const updatedAgencies = [...agencies]

      // Process one at a time to respect rate limits
      for (let i = 0; i < batchToProcess.length; i++) {
        const agency = batchToProcess[i]
        const globalIndex = start + i

        // Build full address from all available fields, stripping any URLs/markdown
        const fullAddress = [agency.address, agency.city, agency.state, agency.zip]
          .map(cleanAddress)
          .filter(Boolean)
          .join(', ')
          .replace(/,\s*,/g, ',')  // clean up double commas
          .replace(/,\s*$/, '')    // remove trailing comma
        const geocoded = await geocodeAddress(fullAddress)

        if (geocoded.success) {
          updatedAgencies[globalIndex] = {
            ...updatedAgencies[globalIndex],
            parsed: geocoded
          }
          geocodedCount++
        } else if (agency.parsed?.success) {
          regexFallbackCount++
        }

        // Update preview and progress in real-time
        setAgencies([...updatedAgencies])
        updatePreview(batchIndex, updatedAgencies)

        // Update progress
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        const remaining = batchToProcess.length - (i + 1)
        const eta = remaining > 0 ? Math.round((elapsed / (i + 1)) * remaining) : 0
        toast.loading(
          `Geocoded ${i + 1}/${batchToProcess.length} in batch... (ETA: ${eta}s)`,
          { id: 'geocoding' }
        )

        // Rate limiting: wait 1 second between requests for free tier
        if (i < batchToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      setAgencies(updatedAgencies)

      let message = `Geocoded ${geocodedCount} addresses successfully`
      if (regexFallbackCount > 0) {
        message += ` (${regexFallbackCount} using regex fallback)`
      }
      toast.success(message, { id: 'geocoding' })
    } catch (error) {
      console.error('Geocoding error:', error)
      toast.error('Geocoding failed', { id: 'geocoding' })
    } finally {
      setGeocoding(false)
    }
  }

  async function tryGeocoding() {
    // Geocode ALL addresses
    geocodeBatch(0)
    // Continue with remaining batches automatically
    for (let i = 1; i < Math.ceil(agencies.length / batchSize); i++) {
      await geocodeBatch(i)
    }
  }

  function updatePreview(batchIndex, agenciesData) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, agenciesData.length)
    setPreview(agenciesData.slice(start, end))
  }

  async function applyCleanupBatch() {
    // Get only the current batch that has been successfully parsed
    const start = currentBatch * batchSize
    const end = Math.min(start + batchSize, agencies.length)
    const batchAgencies = agencies.slice(start, end)
    const successfullyParsed = batchAgencies.filter(a => a.parsed?.success)

    if (successfullyParsed.length === 0) {
      toast.error('No successfully parsed addresses in current batch')
      return
    }

    if (!confirm(`This will update ${successfullyParsed.length} agency records from this batch in the database. Continue?`)) {
      return
    }

    await applyCleanupToAgencies(successfullyParsed)
  }

  async function applyCleanup() {
    const successfullyParsed = agencies.filter(a => a.parsed?.success)

    if (!confirm(`This will update ${successfullyParsed.length} agency records in the database. Continue?`)) {
      return
    }

    await applyCleanupToAgencies(successfullyParsed)
  }

  async function applyCleanupToAgencies(agenciesToUpdate) {

    setProcessing(true)
    let successCount = 0
    let failCount = 0
    let skippedCount = 0

    try {
      toast.loading(`Updating 0/${agenciesToUpdate.length} agencies...`, { id: 'applying' })

      for (let i = 0; i < agenciesToUpdate.length; i++) {
        const agency = agenciesToUpdate[i]
        const parsedData = agency.parsed

        if (!parsedData?.success) {
          console.log(`Skipping ${agency.name} - no valid parsed data`)
          skippedCount++
          continue
        }

        const updates = {
          address: parsedData.street,
          city: parsedData.city,
          state: parsedData.state,
          zip: parsedData.zip
        }

        console.log(`Updating ${agency.name}:`, updates)

        const { error } = await supabase
          .from('agencies')
          .update(updates)
          .eq('id', agency.id)

        if (error) {
          console.error(`Failed to update ${agency.name}:`, {
            error,
            errorMessage: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            errorHint: error.hint
          })
          failCount++
        } else {
          successCount++
        }

        // Update progress every 10 records
        if ((i + 1) % 10 === 0 || i === agenciesToUpdate.length - 1) {
          toast.loading(`Updated ${i + 1}/${agenciesToUpdate.length} agencies...`, { id: 'applying' })
        }
      }

      toast.success(`Updated ${successCount} agencies successfully!`, { id: 'applying' })
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} addresses`)
      }
      if (skippedCount > 0) {
        toast.error(`Skipped ${skippedCount} addresses (no valid data)`)
      }

      console.log(`Summary: ${successCount} success, ${failCount} failed, ${skippedCount} skipped`)

      // Reload the list
      loadAgenciesNeedingCleanup()
    } catch (error) {
      console.error('Error during cleanup:', error)
      toast.error('Cleanup failed: ' + error.message, { id: 'applying' })
    } finally {
      setProcessing(false)
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

  const parsedSuccessfully = agencies.filter(a => a.parsed?.success).length
  const parseFailed = agencies.length - parsedSuccessfully

  return (
    <AppShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Address Data Cleanup</h1>
            <p className="text-gray-600 mt-1">
              Parse full addresses into separate city, state, and zip fields
            </p>
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Recommended:</strong> Use "Geocode All Addresses" first to standardize and fix typos
                (e.g., "Edwardville" → "Edwardsville", "St Louis" → "Saint Louis")
              </p>
            </div>
          </div>

          {/* Test Geocoding */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Test Geocoding (Single Address)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Test the geocoding on one address to verify it's working correctly
            </p>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder="e.g., 4438 Chippewa St, Saint Louis Mo"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && testGeocode()}
              />
              <button
                onClick={testGeocode}
                disabled={testing}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {testResult.success ? (
                  <div>
                    <h3 className="font-semibold text-green-900 mb-2">✓ Success!</h3>
                    <div className="space-y-1 text-sm">
                      <div><strong>Street:</strong> {testResult.street}</div>
                      <div><strong>City:</strong> {testResult.city}</div>
                      <div><strong>State:</strong> {testResult.state}</div>
                      <div><strong>Zip:</strong> {testResult.zip}</div>
                      {testResult.formatted && (
                        <div className="mt-2 pt-2 border-t border-green-300">
                          <strong>Full Address:</strong> {testResult.formatted}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">✗ Failed</h3>
                    <p className="text-sm text-red-700">{testResult.error || 'Unknown error'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* No data message */}
          {agencies.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-green-900 mb-2">
                All agencies already have complete address data!
              </h3>
              <p className="text-sm text-green-700">
                Every agency with an address already has city, state, and zip code filled in.
                No cleanup needed.
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{agencies.length}</div>
                <div className="text-sm text-gray-600">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{parsedSuccessfully}</div>
                <div className="text-sm text-gray-600">Can Parse</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{parseFailed}</div>
                <div className="text-sm text-gray-600">Failed to Parse</div>
              </div>
            </div>

            {/* Batch Navigation */}
            {agencies.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    Batch {currentBatch + 1} of {Math.ceil(agencies.length / batchSize)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newBatch = Math.max(0, currentBatch - 1)
                        setCurrentBatch(newBatch)
                        updatePreview(newBatch, agencies)
                      }}
                      disabled={currentBatch === 0}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => {
                        const newBatch = Math.min(Math.ceil(agencies.length / batchSize) - 1, currentBatch + 1)
                        setCurrentBatch(newBatch)
                        updatePreview(newBatch, agencies)
                      }}
                      disabled={currentBatch >= Math.ceil(agencies.length / batchSize) - 1}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  Showing records {currentBatch * batchSize + 1} - {Math.min((currentBatch + 1) * batchSize, agencies.length)} of {agencies.length}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={() => geocodeBatch(currentBatch)}
                disabled={geocoding || processing}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {geocoding ? 'Geocoding...' : `Geocode Current Batch (${Math.min(batchSize, agencies.length - currentBatch * batchSize)} addresses)`}
              </button>

              <button
                onClick={tryGeocoding}
                disabled={geocoding || processing}
                className="w-full bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600 disabled:opacity-50 font-medium text-sm"
              >
                {geocoding ? 'Geocoding...' : `Geocode All ${agencies.length} Addresses`}
              </button>

              {(() => {
                const start = currentBatch * batchSize
                const end = Math.min(start + batchSize, agencies.length)
                const batchParsed = agencies.slice(start, end).filter(a => a.parsed?.success).length
                return batchParsed > 0 && (
                  <button
                    onClick={applyCleanupBatch}
                    disabled={processing || geocoding}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {processing ? 'Processing...' : `Apply Cleanup to Current Batch (${batchParsed} agencies)`}
                  </button>
                )
              })()}

              {parsedSuccessfully > 0 && (
                <button
                  onClick={applyCleanup}
                  disabled={processing || geocoding}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                >
                  {processing ? 'Processing...' : `Apply Cleanup to All ${parsedSuccessfully} Agencies`}
                </button>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">
                Preview - Batch {currentBatch + 1} ({preview.length} records)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Agency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Current Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Parsed Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((agency) => {
                    const hasChanges = agency.parsed?.success
                    const addressChanged = hasChanges && agency.parsed.street !== agency.address
                    const cityChanged = hasChanges && agency.parsed.city !== agency.city
                    const stateChanged = hasChanges && agency.parsed.state !== agency.state
                    const zipChanged = hasChanges && agency.parsed.zip !== agency.zip

                    return (
                      <tr key={agency.id} className={hasChanges ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {agency.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="space-y-1">
                            <div className={addressChanged ? 'line-through text-red-600' : ''}>{agency.address}</div>
                            {agency.city && <div className={`text-xs ${cityChanged ? 'line-through text-red-600' : ''}`}>City: {agency.city}</div>}
                            {agency.state && <div className={`text-xs ${stateChanged ? 'line-through text-red-600' : ''}`}>State: {agency.state}</div>}
                            {agency.zip && <div className={`text-xs ${zipChanged ? 'line-through text-red-600' : ''}`}>Zip: {agency.zip}</div>}
                            {!agency.city && <div className="text-xs text-gray-400">City: (empty)</div>}
                            {!agency.state && <div className="text-xs text-gray-400">State: (empty)</div>}
                            {!agency.zip && <div className="text-xs text-gray-400">Zip: (empty)</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {agency.parsed?.success ? (
                            <div className="space-y-1">
                              <div className={`font-medium ${addressChanged ? 'text-green-600' : ''}`}>
                                {agency.parsed.street}
                                {addressChanged && <span className="ml-1 text-xs">📝</span>}
                              </div>
                              <div className="text-xs">
                                <span className={cityChanged ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                                  {agency.parsed.city}
                                </span>
                                {', '}
                                <span className={stateChanged ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                                  {agency.parsed.state}
                                </span>
                                {' '}
                                <span className={zipChanged ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                                  {agency.parsed.zip}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-red-600 text-xs">
                              {geocoding ? '⏳ Processing...' : 'Could not parse'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {agency.parsed?.success ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {geocoding ? '⏳' : '✗'} {geocoding ? 'Pending' : 'Failed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Failed Addresses */}
          {parseFailed > 0 && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-900 mb-2">
                {parseFailed} Address{parseFailed !== 1 ? 'es' : ''} Could Not Be Parsed
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                These addresses don't match the expected format. You may need to update them manually.
              </p>
              <div className="space-y-2">
                {agencies.filter(a => !a.parsed?.success).slice(0, 5).map(agency => (
                  <div key={agency.id} className="text-sm">
                    <span className="font-medium">{agency.name}:</span>{' '}
                    <span className="text-gray-600">{agency.address}</span>
                  </div>
                ))}
                {parseFailed > 5 && (
                  <div className="text-sm text-yellow-600">
                    And {parseFailed - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </AppShell>
  )
}
