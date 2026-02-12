'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useAuth } from '@/components/AuthProvider'
import { useSearchParams, useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import MissingDataBadge from '@/components/frm/MissingDataBadge'
import { useDraftSave } from '@/lib/frm/hooks/useDraftSave'
import PhotoUpload from '@/components/frm/PhotoUpload'
import VisitAttachments from '@/components/frm/VisitAttachments'
import { isAgencyComplete, isContactComplete } from '@/lib/frm/dataQuality'
import { getLocalDateString } from '@/lib/frm/dateUtils'
import { hapticLight, hapticSuccess } from '@/lib/frm/utils/haptics'
import toast from 'react-hot-toast'

function LogVisitForm() {
  const { user } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [frms, setFRMs] = useState([])
  const [selectedFRM, setSelectedFRM] = useState('')
  const [agencySearch, setAgencySearch] = useState('')
  const [agencies, setAgencies] = useState([])
  const [selectedAgency, setSelectedAgency] = useState(null)
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [visitDate, setVisitDate] = useState(getLocalDateString())
  const [notes, setNotes, clearNotesDraft, draftSaved] = useDraftSave('logVisitDraft')
  const [submitting, setSubmitting] = useState(false)
  const [createdVisitId, setCreatedVisitId] = useState(null)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [extractedContact, setExtractedContact] = useState(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [attachmentRefresh, setAttachmentRefresh] = useState(0)
  const [currentAgencyId, setCurrentAgencyId] = useState(null)
  const [existingContact, setExistingContact] = useState(null)
  const [businessCardAttachmentId, setBusinessCardAttachmentId] = useState(null)

  useEffect(() => {
    fetchFRMs()
    setCurrentUserFRM()
  }, [user])

  // Check for pre-filled agency from URL params
  useEffect(() => {
    const agencyId = searchParams.get('agencyId')
    const agencyName = searchParams.get('agencyName')

    if (agencyId && agencyName) {
      fetchAndSelectAgency(agencyId)
    }
  }, [searchParams])

  // Auto-search as user types (debounced)
  useEffect(() => {
    if (!agencySearch.trim()) {
      setAgencies([])
      return
    }

    const timeoutId = setTimeout(() => {
      searchAgencies()
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [agencySearch])

  async function fetchFRMs() {
    const { data } = await supabase
      .from('frms')
      .select('*')
      .eq('active', true)
      .order('name')
    setFRMs(data || [])
  }

  async function setCurrentUserFRM() {
    if (!user) return

    const { data } = await supabase
      .from('frms')
      .select('id')
      .eq('email', user.email)
      .single()

    if (data) {
      setSelectedFRM(data.id)
    }
  }

  async function fetchAndSelectAgency(agencyId) {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', agencyId)
        .single()

      if (error) throw error

      if (data) {
        await selectAgency(data)
      }
    } catch (err) {
      console.error('Error fetching pre-filled agency:', err)
      toast.error('Failed to load agency information')
    }
  }

  async function searchAgencies() {
    if (!agencySearch.trim()) {
      setAgencies([])
      return
    }

    const { data } = await supabase
      .from('agencies')
      .select('*')
      .ilike('name', `%${agencySearch}%`)
      .order('name')
      .limit(20)

    setAgencies(data || [])
  }

  async function selectAgency(agency) {
    hapticLight()
    setSelectedAgency(agency)
    setAgencies([]) // Clear dropdown
    setAgencySearch(agency.name) // Show selected agency name, then clear

    // Clear search after a moment so it doesn't interfere
    setTimeout(() => {
      setAgencySearch('')
    }, 100)

    // Fetch contacts for this agency
    const { data } = await supabase
      .from('agency_contacts')
      .select('*')
      .eq('agency_id', agency.id)
      .order('name')

    setContacts(data || [])
  }

  function toggleContact(contactId) {
    hapticLight()
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId)
      } else {
        return [...prev, contactId]
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!selectedFRM) {
      toast.error('Please select an FRM')
      return
    }

    if (!selectedAgency) {
      toast.error('Please select an agency')
      return
    }

    if (!visitDate) {
      toast.error('Please select a visit date')
      return
    }

    try {
      setSubmitting(true)

      // Create a visit record
      const { data: visitData, error } = await supabase
        .from('visits')
        .insert({
          frm_id: selectedFRM,
          agency_id: selectedAgency.id,
          visit_date: visitDate,
          conversation_notes: notes.trim() || null
        })
        .select()
        .single()

      if (error) throw error

      hapticSuccess()
      toast.success('Visit logged successfully!')

      // Clear draft from localStorage
      clearNotesDraft()

      // Store visit ID, agency ID and show photo upload option
      setCreatedVisitId(visitData.id)
      setCurrentAgencyId(selectedAgency.id)
      setShowPhotoUpload(true)

    } catch (err) {
      console.error('Error logging visit:', err)
      toast.error('Failed to log visit')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleContactExtracted(parsedContact, ocrText, attachmentId) {
    const agencyId = currentAgencyId || selectedAgency?.id

    console.log('Contact extracted:', parsedContact)
    console.log('Agency ID:', agencyId)
    console.log('Attachment ID:', attachmentId)

    if (!agencyId) {
      toast.error('No agency selected. Cannot save contact.')
      return
    }

    // Store the attachment ID to link it to the contact later
    setBusinessCardAttachmentId(attachmentId)

    // Check if a contact with this name already exists at this agency
    try {
      const { data: existingContacts, error } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .ilike('name', parsedContact.name || '')

      if (error) throw error

      if (existingContacts && existingContacts.length > 0) {
        // Contact exists - show update option
        setExistingContact(existingContacts[0])
      } else {
        setExistingContact(null)
      }
    } catch (err) {
      console.error('Error checking for existing contact:', err)
    }

    setExtractedContact({
      ...parsedContact,
      ocrText,
      agency_id: agencyId
    })
    setShowContactModal(true)
  }

  async function handleSaveContact(isUpdate = false) {
    if (!extractedContact || !extractedContact.agency_id) {
      console.error('Missing data:', { extractedContact })
      toast.error('Missing required information')
      return
    }

    try {
      console.log('Saving contact:', extractedContact, 'isUpdate:', isUpdate)

      let contactId

      if (isUpdate && existingContact) {
        // Update existing contact
        const { data, error } = await supabase
          .from('agency_contacts')
          .update({
            email: extractedContact.email || existingContact.email,
            phone: extractedContact.phone || existingContact.phone,
            title: extractedContact.title || existingContact.title,
            desk_location: extractedContact.desk_location || existingContact.desk_location
          })
          .eq('id', existingContact.id)
          .select()

        if (error) throw error
        contactId = existingContact.id
        console.log('Contact updated:', data)
        toast.success('Contact updated successfully!')
      } else {
        // Create new contact
        const { data, error } = await supabase
          .from('agency_contacts')
          .insert({
            agency_id: extractedContact.agency_id,
            name: extractedContact.name || '',
            email: extractedContact.email || null,
            phone: extractedContact.phone || null,
            title: extractedContact.title || null,
            desk_location: extractedContact.desk_location || null
          })
          .select()

        if (error) throw error
        contactId = data[0].id
        console.log('Contact created:', data)
        toast.success('Contact saved successfully!')
      }

      // Link the business card photo to the contact
      if (businessCardAttachmentId && contactId) {
        const { error: linkError } = await supabase
          .from('visit_attachments')
          .update({ contact_id: contactId })
          .eq('id', businessCardAttachmentId)

        if (linkError) {
          console.error('Error linking photo to contact:', linkError)
        } else {
          console.log('Business card photo linked to contact')
        }
      }

      hapticSuccess()
      setShowContactModal(false)
      setExtractedContact(null)
      setExistingContact(null)
      setBusinessCardAttachmentId(null)
    } catch (err) {
      console.error('Error saving contact:', err)
      toast.error(`Failed to save contact: ${err.message}`)
    }
  }

  function handleFinishAndContinue() {
    // Reset form state
    setSelectedAgency(null)
    setContacts([])
    setSelectedContacts([])
    setVisitDate(getLocalDateString())
    setNotes('')
    setAgencies([])
    setAgencySearch('')
    setCreatedVisitId(null)
    setCurrentAgencyId(null)
    setShowPhotoUpload(false)
    setExtractedContact(null)
    setShowContactModal(false)
    setAttachmentRefresh(0)
  }

  function handleFinishAndClose() {
    router.push('/marketing/frm/agency-lookup')
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>Log Visit</h1>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">

            {/* FRM Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Representative *
              </label>
              <select
                value={selectedFRM}
                onChange={(e) => setSelectedFRM(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select FRM</option>
                {frms.map(frm => (
                  <option key={frm.id} value={frm.id}>{frm.name}</option>
                ))}
              </select>
            </div>

            {/* Agency Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agency *
              </label>
              {selectedAgency ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{selectedAgency.name}</div>
                      <div className="text-sm text-gray-600">
                        {selectedAgency.city}, {selectedAgency.state}
                      </div>

                      {(() => {
                        const quality = isAgencyComplete(selectedAgency)
                        if (!quality.complete) {
                          return (
                            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <MissingDataBadge
                                  type="agency"
                                  missing={quality.missing}
                                  size="sm"
                                />
                                <span className="text-sm font-medium text-yellow-800">
                                  Incomplete address data
                                </span>
                              </div>
                              <a
                                href="/marketing/frm/data-entry"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Fix in Data Entry →
                              </a>
                            </div>
                          )
                        }
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAgency(null)
                        setContacts([])
                        setSelectedContacts([])
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={agencySearch}
                    onChange={(e) => setAgencySearch(e.target.value)}
                    placeholder="Start typing agency name..."
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />

                  {agencies.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {agencies.map(agency => (
                        <button
                          key={agency.id}
                          type="button"
                          onClick={() => selectAgency(agency)}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">{agency.name}</div>
                          <div className="text-xs text-gray-600">
                            {agency.city}, {agency.state}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {agencySearch.trim() && agencies.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                      No agencies found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Selection */}
            {contacts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Contacts Present (Optional)
                  {(() => {
                    const incompleteCount = contacts.filter(c => !isContactComplete(c).complete).length
                    if (incompleteCount > 0) {
                      return (
                        <span className="ml-2 text-xs text-yellow-600">
                          ⚠️ {incompleteCount} {incompleteCount === 1 ? 'contact' : 'contacts'} missing email or phone
                        </span>
                      )
                    }
                  })()}
                </label>
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50 max-h-60 overflow-y-auto">
                  {contacts.map(contact => {
                    const contactQuality = isContactComplete(contact)
                    return (
                      <label
                        key={contact.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-white p-2 rounded transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{contact.name}</div>
                            {!contactQuality.complete && (
                              <MissingDataBadge
                                type="contact"
                                missing={contactQuality.missing}
                                size="sm"
                              />
                            )}
                          </div>
                          {contact.title && (
                            <div className="text-xs text-gray-600">{contact.title}</div>
                          )}
                          {contact.email && (
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
                {selectedContacts.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            {/* Visit Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visit Date *
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                max={getLocalDateString()}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversation Notes
                {draftSaved && (
                  <span className="ml-2 text-xs text-green-600 transition-opacity">
                    ✓ Draft saved
                  </span>
                )}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="What was discussed during the visit?"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !selectedFRM || !selectedAgency}
              className="w-full py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: submitting || !selectedFRM || !selectedAgency ? '#9ca3af' : '#9D2235' }}
              onMouseEnter={(e) => {
                if (!submitting && selectedFRM && selectedAgency) {
                  e.currentTarget.style.backgroundColor = '#7a1a2a'
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting && selectedFRM && selectedAgency) {
                  e.currentTarget.style.backgroundColor = '#9D2235'
                }
              }}
            >
              {submitting ? 'Logging Visit...' : 'Log Visit'}
            </button>
          </form>

          {/* Photo Upload Section - Shows after visit is created */}
          {showPhotoUpload && createdVisitId && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#9D2235' }}>
                  ✅ Visit Logged Successfully!
                </h2>
                <p className="text-gray-600 mb-4">
                  Would you like to add photos to this visit?
                </p>
              </div>

              <PhotoUpload
                visitId={createdVisitId}
                onUploadComplete={() => {
                  setAttachmentRefresh(prev => prev + 1)
                }}
                onContactExtracted={handleContactExtracted}
              />

              {/* Display uploaded photos */}
              {createdVisitId && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Photos</h3>
                  <VisitAttachments
                    visitId={createdVisitId}
                    key={attachmentRefresh}
                  />
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleFinishAndContinue}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Log Another Visit
                </button>
                <button
                  onClick={handleFinishAndClose}
                  className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Business Card Contact Review Modal */}
        {showContactModal && extractedContact && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowContactModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-xl font-semibold mb-4" style={{ color: '#9D2235' }}>
                  📇 Review Business Card Data
                </h3>
                {existingContact ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      ⚠️ Contact Already Exists
                    </p>
                    <p className="text-xs text-yellow-700">
                      A contact named "{existingContact.name}" already exists at this agency.
                      You can update their information with the new details from this business card.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mb-4">
                    Please review the extracted information and make any corrections:
                  </p>
                )}

                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={extractedContact.name || ''}
                      onChange={(e) => setExtractedContact({...extractedContact, name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contact name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={extractedContact.title || ''}
                      onChange={(e) => setExtractedContact({...extractedContact, title: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Job title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={extractedContact.email || ''}
                      onChange={(e) => setExtractedContact({...extractedContact, email: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={extractedContact.phone || ''}
                      onChange={(e) => setExtractedContact({...extractedContact, phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desk Location</label>
                    <input
                      type="text"
                      value={extractedContact.desk_location || ''}
                      onChange={(e) => setExtractedContact({...extractedContact, desk_location: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Front desk, Back left, Office 3"
                    />
                  </div>

                  {extractedContact.confidence && (
                    <div className="text-xs text-gray-500 mt-2">
                      Confidence: <span className="capitalize">{extractedContact.confidence}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {existingContact ? (
                    <>
                      <button
                        onClick={() => handleSaveContact(true)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Update Contact
                      </button>
                      <button
                        onClick={() => handleSaveContact(false)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Create New
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleSaveContact(false)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Save Contact
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowContactModal(false)
                      setExtractedContact(null)
                      setExistingContact(null)
                      setBusinessCardAttachmentId(null)
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
    </AppShell>
  )
}

export default function LogVisit() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    }>
      <LogVisitForm />
    </Suspense>
  )
}
