'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { hapticLight, hapticSuccess, hapticError } from '@/lib/frm/utils/haptics'
import toast from 'react-hot-toast'

export default function AgencyMapDrawer({ agency, zoneColor, zoneName, onClose, onAgencyUpdated }) {
  const supabase = createClient()

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Populate form when agency changes
  useEffect(() => {
    if (agency) {
      setForm({
        name: agency.name || '',
        address: agency.address || '',
        city: agency.city || '',
        state: agency.state || '',
        zip: agency.zip || '',
        phone: agency.phone || '',
      })
      setHasChanges(false)
    }
  }, [agency?.id])

  if (!agency) return null

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    hapticLight()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('agencies')
        .update(form)
        .eq('id', agency.id)

      if (error) throw error

      hapticSuccess()
      toast.success('Agency updated')
      setHasChanges(false)
      onAgencyUpdated({ ...agency, ...form })
    } catch (err) {
      console.error('Error updating agency:', err)
      hapticError()
      toast.error('Failed to update agency')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    hapticLight()
    const newStatus = agency.is_active === false ? true : false
    const action = newStatus ? 'reactivate' : 'deactivate'

    if (!confirm(`Are you sure you want to ${action} "${agency.name}"?`)) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('agencies')
        .update({ is_active: newStatus })
        .eq('id', agency.id)

      if (error) throw error

      hapticSuccess()
      toast.success(`Agency ${newStatus ? 'reactivated' : 'deactivated'}`)
      onAgencyUpdated({ ...agency, ...form, is_active: newStatus })
    } catch (err) {
      console.error('Error toggling agency status:', err)
      hapticError()
      toast.error('Failed to update agency status')
    } finally {
      setSaving(false)
    }
  }

  const handleReGeocode = async () => {
    hapticLight()
    // Use the current form values (may have been edited)
    const address = `${form.address}, ${form.city}, ${form.state} ${form.zip}`

    if (!form.address || !form.city || !form.state) {
      toast.error('Address, city, and state are required for geocoding')
      return
    }

    setGeocoding(true)
    try {
      // Use server-side API route (has the API key configured)
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      const data = await response.json()

      if (data.success && data.latitude && data.longitude) {
        const newLat = data.latitude
        const newLng = data.longitude

        // Save new coordinates + form changes to database
        const { error } = await supabase
          .from('agencies')
          .update({
            ...form,
            latitude: newLat,
            longitude: newLng,
            geocoded: true,
            geocoded_at: new Date().toISOString(),
            geocode_error: null
          })
          .eq('id', agency.id)

        if (error) throw error

        hapticSuccess()
        toast.success(`Geocoded to ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`)
        setHasChanges(false)
        onAgencyUpdated({
          ...agency,
          ...form,
          latitude: newLat,
          longitude: newLng
        })
      } else {
        hapticError()
        toast.error(data.error || 'Could not geocode this address. Check the address and try again.')

        // Store the error
        await supabase
          .from('agencies')
          .update({ geocode_error: `No results for: ${address}` })
          .eq('id', agency.id)
      }
    } catch (err) {
      console.error('Geocoding error:', err)
      hapticError()
      toast.error('Geocoding failed')
    } finally {
      setGeocoding(false)
    }
  }

  const isInactive = agency.is_active === false

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[1100] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[1200] flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: zoneColor || '#999',
                flexShrink: 0,
                border: '2px solid white',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15)'
              }}
            />
            <h2 className="text-lg font-bold text-gray-900 truncate">Edit Agency</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#5B6770] hover:text-[#9D2235] p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Inactive badge */}
          {isInactive && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-700">This agency is deactivated</span>
            </div>
          )}

          {/* Zone info */}
          <div className="text-sm text-[#5B6770]">
            <span className="font-medium">Zone:</span> {zoneName}
          </div>

          {/* Coordinates */}
          <div className="text-xs text-[#5B6770] bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span>
              {agency.latitude && agency.longitude
                ? `${parseFloat(agency.latitude).toFixed(5)}, ${parseFloat(agency.longitude).toFixed(5)}`
                : 'No coordinates'}
            </span>
            {agency.latitude && agency.longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${agency.latitude},${agency.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1982C4] hover:underline font-medium"
              >
                View on Maps
              </a>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#5B6770] mb-1">Agency Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5B6770] mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={e => updateField('address', e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-[#5B6770] mb-1">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => updateField('city', e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5B6770] mb-1">State</label>
                <select
                  value={form.state}
                  onChange={e => updateField('state', e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
                >
                  <option value="">--</option>
                  <option value="MO">MO</option>
                  <option value="IL">IL</option>
                  <option value="KS">KS</option>
                  <option value="OK">OK</option>
                  <option value="AR">AR</option>
                  <option value="IA">IA</option>
                  <option value="NE">NE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5B6770] mb-1">ZIP</label>
                <input
                  type="text"
                  value={form.zip}
                  onChange={e => updateField('zip', e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5B6770] mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9D2235] focus:border-transparent"
              />
            </div>
          </div>

          {/* Re-geocode button */}
          <button
            onClick={handleReGeocode}
            disabled={geocoding}
            className="w-full flex items-center justify-center gap-2 bg-[#457B9D] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[#3a6a88] transition-colors disabled:opacity-50"
          >
            {geocoding ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Geocoding...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Re-Geocode Address
              </>
            )}
          </button>
          <p className="text-xs text-[#5B6770] -mt-2">
            Saves address changes and updates the map pin location
          </p>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 p-4 space-y-2 bg-gray-50">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full bg-[#9D2235] text-white py-2.5 px-4 rounded-lg font-semibold text-sm hover:bg-[#7a1a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Deactivate / Reactivate */}
          <button
            onClick={handleToggleActive}
            disabled={saving}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors border-2 ${
              isInactive
                ? 'border-green-500 text-green-700 hover:bg-green-50'
                : 'border-red-300 text-red-600 hover:bg-red-50'
            } disabled:opacity-40`}
          >
            {isInactive ? 'Reactivate Agency' : 'Deactivate Agency'}
          </button>
        </div>
      </div>
    </>
  )
}
