'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import MissingDataBadge from '@/components/frm/MissingDataBadge'
import AgencyDataQualityIndicator from '@/components/frm/AgencyDataQualityIndicator'
import VisitAttachments from '@/components/frm/VisitAttachments'
import { isAgencyComplete, isContactComplete } from '@/lib/frm/dataQuality'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function AgencyLookup() {
  const supabase = createClient()
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')
  const [agencies, setAgencies] = useState([])
  const [selectedAgency, setSelectedAgency] = useState(null)
  const [visits, setVisits] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAgencyDrawer, setShowAgencyDrawer] = useState(false)
  const [showContactDrawer, setShowContactDrawer] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [agencyForm, setAgencyForm] = useState({})
  const [contactForm, setContactForm] = useState({})
  const dropdownRef = useRef(null)

  // Auto-search as user types
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch()
      } else {
        setAgencies([])
        setShowDropdown(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(delaySearch)
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          zone_assignments (
            zone_id,
            day_of_week,
            week_number,
            sequence_order,
            route_zones (
              zone_name,
              zone_number
            )
          )
        `)
        .or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`)
        .order('name')
        .limit(50)

      if (error) throw error

      setAgencies(data || [])
      setShowDropdown(true)
    } catch (err) {
      console.error('Error searching agencies:', err)
      toast.error('Failed to search agencies')
    } finally {
      setLoading(false)
    }
  }

  async function selectAgency(agency) {
    setSelectedAgency(agency)
    setShowDropdown(false)
    setSearchTerm('')
    setAgencies([])
    setLoading(true)

    try {
      // Fetch visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          frms (name)
        `)
        .eq('agency_id', agency.id)
        .order('visit_date', { ascending: false })

      if (visitsError) throw visitsError
      console.log('Agency visits loaded:', visitsData?.length)
      console.log('First visit:', visitsData?.[0])
      setVisits(visitsData || [])

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agency.id)
        .order('name')

      if (contactsError) throw contactsError
      setContacts(contactsData || [])
    } catch (err) {
      console.error('Error fetching agency details:', err)
      toast.error('Failed to load agency details')
    } finally {
      setLoading(false)
    }
  }

  function clearSelection() {
    setSelectedAgency(null)
    setVisits([])
    setContacts([])
  }

  function openInMaps() {
    if (!selectedAgency) return
    const address = `${selectedAgency.address || ''} ${selectedAgency.city}, ${selectedAgency.state} ${selectedAgency.zip}`
    const encodedAddress = encodeURIComponent(address)
    // Universal maps URL that works on both iOS and Android
    // Use window.location.href instead of window.open to avoid blank tabs on mobile
    window.location.href = `https://maps.google.com/?q=${encodedAddress}`
  }

  function openEditAgency() {
    setAgencyForm({
      name: selectedAgency.name || '',
      address: selectedAgency.address || '',
      city: selectedAgency.city || '',
      state: selectedAgency.state || '',
      zip: selectedAgency.zip || '',
      phone: selectedAgency.phone || ''
    })
    setShowAgencyDrawer(true)
  }

  function openEditContact(contact) {
    setEditingContact(contact)
    setContactForm({
      name: contact.name || '',
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || ''
    })
    setShowContactDrawer(true)
  }

  async function saveAgency() {
    try {
      const { error } = await supabase
        .from('agencies')
        .update(agencyForm)
        .eq('id', selectedAgency.id)

      if (error) throw error

      toast.success('Agency updated successfully')
      setSelectedAgency({ ...selectedAgency, ...agencyForm })
      setShowAgencyDrawer(false)
    } catch (err) {
      console.error('Error updating agency:', err)
      toast.error('Failed to update agency')
    }
  }

  async function toggleAgencyActive() {
    const newStatus = !selectedAgency.is_active
    const action = newStatus ? 'reactivate' : 'deactivate'
    if (!confirm(`Are you sure you want to ${action} this agency? ${!newStatus ? 'It will be removed from route planning.' : 'It will be included in route planning again.'}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('agencies')
        .update({ is_active: newStatus })
        .eq('id', selectedAgency.id)

      if (error) throw error

      toast.success(`Agency ${newStatus ? 'reactivated' : 'deactivated'} successfully`)
      setSelectedAgency({ ...selectedAgency, is_active: newStatus })
    } catch (err) {
      console.error('Error toggling agency status:', err)
      toast.error('Failed to update agency status')
    }
  }

  async function saveContact() {
    try {
      const { error } = await supabase
        .from('agency_contacts')
        .update(contactForm)
        .eq('id', editingContact.id)

      if (error) throw error

      toast.success('Contact updated successfully')
      // Refresh contacts
      const { data } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', selectedAgency.id)
        .order('name')
      setContacts(data || [])
      setShowContactDrawer(false)
    } catch (err) {
      console.error('Error updating contact:', err)
      toast.error('Failed to update contact')
    }
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold" style={{ color: '#9D2235' }}>Agency Lookup</h1>
            <button
              onClick={() => router.push('/marketing/frm/add-agency')}
              className="px-6 py-2 text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2"
              style={{ backgroundColor: '#9D2235' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Agency
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                  if (agencies.length > 0) setShowDropdown(true)
                }}
                placeholder="Start typing agency name, city, or state..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ focusRingColor: '#9D2235' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#9D2235'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />

              {loading && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}

              {showDropdown && agencies.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b">
                    {agencies.length} {agencies.length === 50 ? '+ ' : ''}results
                  </div>
                  {agencies.map(agency => {
                    const quality = isAgencyComplete(agency)
                    return (
                      <button
                        key={agency.id}
                        onClick={() => selectAgency(agency)}
                        className="w-full text-left p-3 hover:bg-gray-50 transition border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`font-medium text-sm ${agency.is_active === false ? 'text-gray-400 line-through' : ''}`}>{agency.name}</div>
                              {agency.is_active === false && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">
                              {agency.address && `${agency.address}, `}
                              {agency.city}, {agency.state} {agency.zip}
                            </div>
                            {agency.zone_assignments && agency.zone_assignments.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {agency.zone_assignments
                                  .filter((z, idx, arr) => arr.findIndex(a => a.route_zones?.zone_number === z.route_zones?.zone_number) === idx)
                                  .map((za, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                      Zone {za.route_zones?.zone_number}
                                      {za.route_zones?.custom_name && ` - ${za.route_zones.custom_name}`}
                                    </span>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                          {!quality.complete && (
                            <MissingDataBadge type="agency" missing={quality.missing} size="sm" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
                <div className="mt-2 text-sm text-gray-500">
                  Type at least 2 characters to search...
                </div>
              )}

              {searchTerm.trim().length >= 2 && !loading && agencies.length === 0 && (
                <div className="mt-2 text-sm text-gray-500">
                  No agencies found. Try a different search term.
                </div>
              )}
            </div>
          </div>

          {selectedAgency && (
            <>
              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-xl">{selectedAgency.name}</h2>
                      {selectedAgency.is_active === false && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <AgencyDataQualityIndicator
                      agency={selectedAgency}
                      contacts={contacts}
                      compact={true}
                    />
                  </div>
                  <div className="text-sm space-y-2 mb-4">
                    {selectedAgency.address && (
                      <button
                        onClick={openInMaps}
                        className="block text-left text-blue-600 hover:underline"
                      >
                        📍 {selectedAgency.address}, {selectedAgency.city}, {selectedAgency.state} {selectedAgency.zip}
                      </button>
                    )}
                    {selectedAgency.phone && (
                      <a href={`tel:${selectedAgency.phone}`} className="block text-gray-600 hover:text-blue-600">
                        📞 {selectedAgency.phone}
                      </a>
                    )}
                  </div>

                  {/* Zone Schedule Section */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Zone Schedule</h3>
                    {selectedAgency.zone_assignments && selectedAgency.zone_assignments.length > 0 ? (
                      <div className="space-y-1">
                        {selectedAgency.zone_assignments
                          .sort((a, b) => a.day_of_week - b.day_of_week || a.week_number - b.week_number)
                          .map((za, idx) => (
                            <div key={idx} className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Zone {za.route_zones?.zone_number}
                                {za.route_zones?.custom_name && ` - ${za.route_zones.custom_name}`}
                              </span>
                              <span>•</span>
                              <span className="font-medium">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][za.day_of_week - 1]}</span>
                              <span>•</span>
                              <span>Week {za.week_number}</span>
                              <span>•</span>
                              <span className="text-xs text-gray-500">Sequence #{za.sequence_order}</span>
                            </div>
                          ))
                        }
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Not assigned to any zone</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap mt-4">
                    <button
                      onClick={openEditAgency}
                      className="px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#5B6770' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a5761'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B6770'}
                    >
                      Edit Agency
                    </button>
                    <button
                      onClick={() => router.push(`/log-visit?agencyId=${selectedAgency.id}&agencyName=${encodeURIComponent(selectedAgency.name)}`)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      Log Visit
                    </button>
                    <button
                      onClick={toggleAgencyActive}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all ${
                        selectedAgency.is_active === false
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                      }`}
                    >
                      {selectedAgency.is_active === false ? 'Reactivate Agency' : 'Deactivate Agency'}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-sm font-semibold hover:underline transition-colors"
                      style={{ color: '#9D2235' }}
                    >
                      Search again
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <h3 className="font-bold mb-3">Contacts ({contacts.length})</h3>
                {contacts.length === 0 ? (
                  <p className="text-gray-500 text-sm">No contacts on file</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contacts.map(contact => {
                      const contactQuality = isContactComplete(contact)
                      return (
                        <div key={contact.id} className="border rounded-lg p-4 hover:shadow-md transition">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-lg">{contact.name}</div>
                              {!contactQuality.complete && (
                                <MissingDataBadge
                                  type="contact"
                                  missing={contactQuality.missing}
                                  size="sm"
                                />
                              )}
                            </div>
                            <button
                              onClick={() => openEditContact(contact)}
                              className="text-xs text-gray-600 hover:text-blue-600 underline"
                            >
                              Edit
                            </button>
                          </div>
                          {contact.title && <div className="text-sm text-gray-600 mb-2">{contact.title}</div>}
                          {contact.desk_location && (
                            <div className="text-sm text-gray-600 mb-2">
                              📍 {contact.desk_location}
                            </div>
                          )}
                          <div className="space-y-1">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline block">
                                ✉️ {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline block">
                                📞 {contact.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold mb-3">Visit History ({visits.length})</h3>
                {visits.length === 0 ? (
                  <p className="text-gray-500 text-sm">No visits recorded</p>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="md:hidden space-y-3">
                      {visits.map(visit => (
                        <div key={visit.id} className="border rounded-lg p-3">
                          <div className="font-medium text-sm mb-2">
                            {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium">FRM:</span> {visit.frms?.name || 'Unknown'}
                            </div>
                            {visit.conversation_notes && (
                              <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                                {visit.conversation_notes}
                              </div>
                            )}
                            {/* Photos inline with visit */}
                            <div className="mt-3">
                              <VisitAttachments visitId={visit.id} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop expanded view */}
                    <div className="hidden md:block space-y-3">
                      {visits.map(visit => (
                        <div key={visit.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-sm">
                                {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">FRM:</span> {visit.frms?.name || 'Unknown'}
                              </div>
                            </div>
                          </div>
                          {visit.conversation_notes && (
                            <div className="text-sm bg-gray-50 p-3 rounded mb-3">
                              {visit.conversation_notes}
                            </div>
                          )}
                          {/* Photos inline with visit */}
                          <VisitAttachments visitId={visit.id} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit Agency Drawer */}
        {showAgencyDrawer && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowAgencyDrawer(false)}
            />
            <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Edit Agency</h2>
                  <button
                    onClick={() => setShowAgencyDrawer(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agency Name *
                    </label>
                    <input
                      type="text"
                      value={agencyForm.name}
                      onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={agencyForm.address}
                      onChange={(e) => setAgencyForm({ ...agencyForm, address: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={agencyForm.city}
                        onChange={(e) => setAgencyForm({ ...agencyForm, city: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={agencyForm.state}
                        onChange={(e) => setAgencyForm({ ...agencyForm, state: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={agencyForm.zip}
                      onChange={(e) => setAgencyForm({ ...agencyForm, zip: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={agencyForm.phone}
                      onChange={(e) => setAgencyForm({ ...agencyForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 555-5555"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={saveAgency}
                      className="flex-1 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#9D2235' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7a1a2a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9D2235'}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setShowAgencyDrawer(false)}
                      className="px-6 py-3 rounded-lg font-semibold transition-all"
                      style={{ backgroundColor: '#e5e7eb', color: '#5B6770' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit Contact Drawer */}
        {showContactDrawer && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowContactDrawer(false)}
            />
            <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Edit Contact</h2>
                  <button
                    onClick={() => setShowContactDrawer(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={contactForm.title}
                      onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Office Manager"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 555-5555"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desk Location
                    </label>
                    <input
                      type="text"
                      value={contactForm.desk_location || ''}
                      onChange={(e) => setContactForm({ ...contactForm, desk_location: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Front desk, Back left, Office 3"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={saveContact}
                      className="flex-1 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#9D2235' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7a1a2a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9D2235'}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setShowContactDrawer(false)}
                      className="px-6 py-3 rounded-lg font-semibold transition-all"
                      style={{ backgroundColor: '#e5e7eb', color: '#5B6770' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </AppShell>
  )
}
