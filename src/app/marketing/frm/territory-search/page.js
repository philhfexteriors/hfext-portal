'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function TerritorySearch() {
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState(10)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [selectedAgencies, setSelectedAgencies] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [existingAgencies, setExistingAgencies] = useState([])
  const supabase = createClient()

  useEffect(() => {
    loadExistingAgencies()
  }, [])

  async function loadExistingAgencies() {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('name, address, city, state, zip')

      if (error) throw error

      setExistingAgencies(data || [])
    } catch (error) {
      console.error('Error loading existing agencies:', error)
    }
  }

  function isAgencyInDatabase(agency) {
    // Check if agency already exists by name and location
    return existingAgencies.some(existing =>
      existing.name.toLowerCase().trim() === agency.name.toLowerCase().trim() &&
      existing.city?.toLowerCase() === agency.city?.toLowerCase() &&
      existing.state?.toLowerCase() === agency.state?.toLowerCase()
    )
  }

  async function searchTerritory() {
    if (!location.trim()) {
      toast.error('Please enter a location (city, zip code, or address)')
      return
    }

    setSearching(true)
    setResults([])
    setSelectedAgencies(new Set())

    try {
      toast.loading('Running comprehensive search (11 queries)... This may take 20-30 seconds.', { id: 'search' })

      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: location,
          radius: radius,
          comprehensive: true
        })
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.agencies || [])

        const newAgencies = data.agencies.filter(a => !isAgencyInDatabase(a))

        if (data.agencies.length === 0) {
          toast.error('No insurance agencies found in this area', { id: 'search' })
        } else {
          toast.success(`Found ${data.agencies.length} agencies (${newAgencies.length} new)`, { id: 'search' })
        }
      } else {
        toast.error(data.error || 'Search failed', { id: 'search' })
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to search territory', { id: 'search' })
    } finally {
      setSearching(false)
    }
  }

  function toggleAgency(index) {
    const newSelected = new Set(selectedAgencies)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedAgencies(newSelected)
  }

  function selectAll() {
    const newAgencies = results
      .map((agency, index) => ({ agency, index }))
      .filter(({ agency }) => !isAgencyInDatabase(agency))
      .map(({ index }) => index)

    setSelectedAgencies(new Set(newAgencies))
  }

  function deselectAll() {
    setSelectedAgencies(new Set())
  }

  async function importSelected() {
    const agenciesToImport = Array.from(selectedAgencies).map(index => results[index])

    if (agenciesToImport.length === 0) {
      toast.error('No agencies selected')
      return
    }

    setImporting(true)

    try {
      toast.loading(`Importing ${agenciesToImport.length} agencies...`, { id: 'import' })

      // Insert all agencies in one batch
      const { data, error } = await supabase
        .from('agencies')
        .insert(
          agenciesToImport.map(agency => ({
            name: agency.name,
            address: agency.address,
            city: agency.city,
            state: agency.state,
            zip: agency.zip,
            phone: agency.phone || null,
            website: agency.website || null,
            // Mark as new prospect
            notes: `Auto-discovered via territory search on ${new Date().toLocaleDateString()}`
          }))
        )
        .select()

      if (error) throw error

      toast.success(`Successfully imported ${data.length} agencies!`, { id: 'import' })

      // Reload existing agencies
      await loadExistingAgencies()

      // Clear selection
      setSelectedAgencies(new Set())

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import agencies', { id: 'import' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-6">Territory Search</h1>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-gray-600 mb-4">
              Search for insurance agencies in your market. Discover new prospects and add them to your database.
              <span className="block text-sm text-gray-500 mt-2">
                ℹ️ Comprehensive search runs 11 different queries focused on residential property insurance (home/homeowners insurance + major carriers: State Farm, Allstate, Farmers, Liberty Mutual, Nationwide, American Family, Auto-Owners, Shelter, Farm Bureau) to find 100-180+ agencies per search.
              </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (City, Zip Code, or Address)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Edwardsville IL, 62025, or Saint Louis MO"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && searchTerritory()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Radius (miles)
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5}>5 miles</option>
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                </select>
              </div>
            </div>

            <button
              onClick={searchTerritory}
              disabled={searching || !location.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {searching ? 'Searching...' : 'Search for Insurance Agencies'}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">
                      Found {results.length} Agencies
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {results.filter(a => !isAgencyInDatabase(a)).length} new • {' '}
                      {results.filter(a => isAgencyInDatabase(a)).length} already in database
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Select All New
                    </button>
                    <button
                      onClick={deselectAll}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={importSelected}
                      disabled={selectedAgencies.size === 0 || importing}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importing ? 'Importing...' : `Import ${selectedAgencies.size} Selected`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((agency, index) => {
                      const inDatabase = isAgencyInDatabase(agency)
                      const isSelected = selectedAgencies.has(index)

                      return (
                        <tr
                          key={index}
                          className={`
                            ${inDatabase ? 'bg-gray-100 text-gray-400' : ''}
                            ${isSelected ? 'bg-blue-50' : ''}
                          `}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAgency(index)}
                              disabled={inDatabase}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{agency.name}</div>
                            {agency.website && (
                              <a
                                href={agency.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {agency.website}
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              {agency.address && <div>{agency.address}</div>}
                              <div className="text-gray-500">
                                {agency.city}, {agency.state} {agency.zip}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {agency.phone || <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {agency.rating ? (
                              <div className="text-sm">
                                <span className="text-yellow-500">★</span> {agency.rating.toFixed(1)}
                                <span className="text-xs text-gray-500 ml-1">
                                  ({agency.ratingCount})
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {inDatabase ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">
                                In Database
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                New Prospect
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Empty State */}
          {results.length === 0 && !searching && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Search for Agencies</h3>
              <p className="text-gray-500">
                Enter a location above to discover insurance agencies in your market
              </p>
            </div>
          )}
        </div>
    </AppShell>
  )
}
