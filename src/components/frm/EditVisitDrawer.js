'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import toast from 'react-hot-toast'

export default function EditVisitDrawer({ visit, onClose, onSave }) {
  const supabase = createClient()

  const [frms, setFRMs] = useState([])
  const [agencies, setAgencies] = useState([])
  const [contacts, setContacts] = useState([])

  const [selectedFRM, setSelectedFRM] = useState(visit?.frm_id || '')
  const [selectedAgency, setSelectedAgency] = useState(visit?.agency_id || '')
  const [selectedContacts, setSelectedContacts] = useState([])
  const [visitDate, setVisitDate] = useState(visit?.visit_date || '')
  const [notes, setNotes] = useState(visit?.conversation_notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visit) {
      fetchData()
    }
  }, [visit])

  async function fetchData() {
    // Fetch FRMs
    const { data: frmsData } = await supabase
      .from('frms')
      .select('*')
      .eq('active', true)
      .order('name')
    setFRMs(frmsData || [])

    // Fetch agencies
    const { data: agenciesData } = await supabase
      .from('agencies')
      .select('*')
      .order('name')
    setAgencies(agenciesData || [])

    // Fetch contacts for selected agency
    if (visit?.agency_id) {
      const { data: contactsData } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', visit.agency_id)
        .order('name')
      setContacts(contactsData || [])
    }
  }

  async function handleAgencyChange(agencyId) {
    setSelectedAgency(agencyId)
    setSelectedContacts([])

    if (agencyId) {
      const { data } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .order('name')
      setContacts(data || [])
    } else {
      setContacts([])
    }
  }

  function toggleContact(contactId) {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId)
      } else {
        return [...prev, contactId]
      }
    })
  }

  async function handleSave() {
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
      setSaving(true)

      const { data, error} = await supabase
        .from('visits')
        .update({
          frm_id: selectedFRM,
          agency_id: selectedAgency,
          visit_date: visitDate,
          conversation_notes: notes.trim() || null
        })
        .eq('id', visit.id)
        .select()

      if (error) throw error

      toast.success('Visit updated successfully!')
      await onSave()
    } catch (err) {
      console.error('Error updating visit:', err)
      toast.error(err?.message || 'Failed to update visit')
    } finally {
      setSaving(false)
    }
  }

  if (!visit) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: '#9D2235' }}>
              Edit Visit
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* FRM Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Representative *
              </label>
              <select
                value={selectedFRM}
                onChange={(e) => setSelectedFRM(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select FRM</option>
                {frms.map(frm => (
                  <option key={frm.id} value={frm.id}>{frm.name}</option>
                ))}
              </select>
            </div>

            {/* Agency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agency *
              </label>
              <select
                value={selectedAgency}
                onChange={(e) => handleAgencyChange(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Agency</option>
                {agencies.map(agency => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} - {agency.city}, {agency.state}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact Selection */}
            {contacts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Contacts Present (Optional)
                </label>
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50 max-h-60 overflow-y-auto">
                  {contacts.map(contact => (
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
                        <div className="font-medium text-sm">{contact.name}</div>
                        {contact.title && (
                          <div className="text-xs text-gray-600">{contact.title}</div>
                        )}
                        {contact.email && (
                          <div className="text-xs text-gray-500">{contact.email}</div>
                        )}
                      </div>
                    </label>
                  ))}
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
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversation Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="What was discussed during the visit?"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || !selectedFRM || !selectedAgency || !visitDate}
                className="flex-1 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: saving || !selectedFRM || !selectedAgency || !visitDate ? '#9ca3af' : '#9D2235' }}
                onMouseEnter={(e) => {
                  if (!saving && selectedFRM && selectedAgency && visitDate) {
                    e.currentTarget.style.backgroundColor = '#7a1a2a'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving && selectedFRM && selectedAgency && visitDate) {
                    e.currentTarget.style.backgroundColor = '#9D2235'
                  }
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
