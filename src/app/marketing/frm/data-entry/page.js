'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import DataQualityStats from '@/components/frm/DataQualityStats'
import MissingDataBadge from '@/components/frm/MissingDataBadge'
import InlineEditField from '@/components/frm/InlineEditField'
import { isAgencyComplete, isContactComplete, getAgencyQualityStatus } from '@/lib/frm/dataQuality'
import toast from 'react-hot-toast'

export default function DataEntry() {
  const supabase = createClient()

  // State
  const [filterMode, setFilterMode] = useState('incomplete') // 'all' | 'incomplete'
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name') // 'name' | 'missing' | 'city'

  const [agencies, setAgencies] = useState([])
  const [allContacts, setAllContacts] = useState([])
  const [agencyContactsMap, setAgencyContactsMap] = useState({})

  const [expandedAgencies, setExpandedAgencies] = useState(new Set())
  const [loading, setLoading] = useState(true)

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch all agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('*')
        .order('name')

      if (agenciesError) throw agenciesError
      setAgencies(agenciesData || [])

      // Fetch all contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('agency_contacts')
        .select('*')
        .order('name')

      if (contactsError) throw contactsError
      setAllContacts(contactsData || [])

      // Build agency -> contacts map
      const contactsMap = {}
      contactsData?.forEach(contact => {
        if (!contactsMap[contact.agency_id]) {
          contactsMap[contact.agency_id] = []
        }
        contactsMap[contact.agency_id].push(contact)
      })
      setAgencyContactsMap(contactsMap)

    } catch (err) {
      console.error('Error fetching data:', err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort agencies
  const filteredAgencies = useMemo(() => {
    let result = agencies

    // Apply filter mode
    if (filterMode === 'incomplete') {
      result = result.filter(agency => {
        const agencyQuality = isAgencyComplete(agency)
        const contacts = agencyContactsMap[agency.id] || []
        const contactsIncomplete = contacts.some(c => !isContactComplete(c).complete)
        return !agencyQuality.complete || contactsIncomplete
      })
    }

    // Apply search
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      result = result.filter(agency =>
        agency.name?.toLowerCase().includes(search) ||
        agency.city?.toLowerCase().includes(search) ||
        agency.state?.toLowerCase().includes(search)
      )
    }

    // Apply sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'missing') {
        const aMissing = isAgencyComplete(a).missing.length
        const bMissing = isAgencyComplete(b).missing.length
        return bMissing - aMissing // Most missing first
      }
      if (sortBy === 'city') {
        return (a.city || '').localeCompare(b.city || '')
      }
      return 0
    })

    return result
  }, [agencies, agencyContactsMap, filterMode, searchTerm, sortBy])

  // Save agency field
  async function saveAgencyField(agencyId, fieldName, value) {
    const { error } = await supabase
      .from('agencies')
      .update({ [fieldName]: value })
      .eq('id', agencyId)

    if (error) throw error

    // Update local state
    setAgencies(prev =>
      prev.map(a => a.id === agencyId ? { ...a, [fieldName]: value } : a)
    )
  }

  // Save contact field
  async function saveContactField(contactId, fieldName, value) {
    const { error } = await supabase
      .from('agency_contacts')
      .update({ [fieldName]: value })
      .eq('id', contactId)

    if (error) throw error

    // Update local state
    setAllContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, [fieldName]: value } : c)
    )
    setAgencyContactsMap(prev => {
      const newMap = { ...prev }
      Object.keys(newMap).forEach(agencyId => {
        newMap[agencyId] = newMap[agencyId].map(c =>
          c.id === contactId ? { ...c, [fieldName]: value } : c
        )
      })
      return newMap
    })
  }

  function toggleExpanded(agencyId) {
    setExpandedAgencies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(agencyId)) {
        newSet.delete(agencyId)
      } else {
        newSet.add(agencyId)
      }
      return newSet
    })
  }

  if (loading) return <AppShell fullWidth><Loading /></AppShell>

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>
            Data Entry & Quality Management
          </h1>

          <DataQualityStats agencies={agencies} contacts={allContacts} />

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filter Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter
                </label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="incomplete">Incomplete Only</option>
                  <option value="all">All Records</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Name</option>
                  <option value="missing">Most Missing Fields</option>
                  <option value="city">City</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Agency name, city, state..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Showing {filteredAgencies.length} {filteredAgencies.length === 1 ? 'agency' : 'agencies'}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {filteredAgencies.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-4xl mb-4">🎉</div>
                <div className="text-xl font-bold text-gray-700">No incomplete records found!</div>
                <div className="text-gray-500 mt-2">All data is complete for the current filter.</div>
              </div>
            ) : (
              filteredAgencies.map(agency => (
                <AgencyDataEntryCard
                  key={agency.id}
                  agency={agency}
                  contacts={agencyContactsMap[agency.id] || []}
                  expanded={expandedAgencies.has(agency.id)}
                  onToggleExpand={() => toggleExpanded(agency.id)}
                  onSaveAgencyField={(field, value) => saveAgencyField(agency.id, field, value)}
                  onSaveContactField={saveContactField}
                />
              ))
            )}
          </div>
        </div>
    </AppShell>
  )
}

// Agency Card Component
function AgencyDataEntryCard({
  agency,
  contacts,
  expanded,
  onToggleExpand,
  onSaveAgencyField,
  onSaveContactField
}) {
  const quality = getAgencyQualityStatus(agency, contacts)
  const hasIssues = !quality.agencyComplete || quality.contactStats.incomplete > 0

  return (
    <div className={`bg-white rounded-lg shadow ${hasIssues ? 'border-l-4 border-yellow-400' : ''}`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg">{agency.name}</h3>
              {!quality.agencyComplete && (
                <MissingDataBadge type="agency" missing={quality.agencyMissing} size="sm" />
              )}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {agency.city || 'No city'}, {agency.state || 'No state'} {agency.zip || ''}
            </div>
            {quality.contactStats.incomplete > 0 && (
              <div className="text-sm text-yellow-700 mt-1">
                {quality.contactStats.incomplete} incomplete {quality.contactStats.incomplete === 1 ? 'contact' : 'contacts'}
              </div>
            )}
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t p-4 bg-gray-50 space-y-6">
          {/* Agency Fields */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Agency Information</h4>
            <div className="bg-white rounded-lg border divide-y">
              <InlineEditField
                label="Address"
                value={agency.address}
                fieldName="address"
                onSave={onSaveAgencyField}
                placeholder="123 Main St"
              />
              <InlineEditField
                label="City"
                value={agency.city}
                fieldName="city"
                onSave={onSaveAgencyField}
                placeholder="City name"
                required={true}
                isMissing={quality.agencyMissing.includes('city')}
              />
              <InlineEditField
                label="State"
                value={agency.state}
                fieldName="state"
                onSave={onSaveAgencyField}
                placeholder="ST"
                required={true}
                isMissing={quality.agencyMissing.includes('state')}
              />
              <InlineEditField
                label="ZIP Code"
                value={agency.zip}
                fieldName="zip"
                onSave={onSaveAgencyField}
                placeholder="12345"
                required={true}
                isMissing={quality.agencyMissing.includes('zip')}
              />
              <InlineEditField
                label="Phone"
                value={agency.phone}
                fieldName="phone"
                onSave={onSaveAgencyField}
                type="tel"
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          {/* Contacts */}
          {contacts.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-3">
                Contacts ({contacts.length})
              </h4>
              <div className="space-y-3">
                {contacts.map(contact => {
                  const contactQuality = isContactComplete(contact)
                  return (
                    <div
                      key={contact.id}
                      className={`bg-white rounded-lg border p-3 ${
                        !contactQuality.complete ? 'border-yellow-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-medium">{contact.name}</div>
                        {!contactQuality.complete && (
                          <MissingDataBadge
                            type="contact"
                            missing={contactQuality.missing}
                            size="sm"
                          />
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-sm text-gray-600 mb-2">{contact.title}</div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <InlineEditField
                          label="Email"
                          value={contact.email}
                          fieldName="email"
                          onSave={(field, value) => onSaveContactField(contact.id, field, value)}
                          type="email"
                          placeholder="email@example.com"
                          isMissing={contactQuality.missing.includes('email')}
                        />
                        <InlineEditField
                          label="Phone"
                          value={contact.phone}
                          fieldName="phone"
                          onSave={(field, value) => onSaveContactField(contact.id, field, value)}
                          type="tel"
                          placeholder="(555) 555-5555"
                          isMissing={contactQuality.missing.includes('phone')}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
