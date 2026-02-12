'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/frm/AppShell'
import toast from 'react-hot-toast'

export default function AddAgency() {
  const supabase = createClient()
  const router = useRouter()

  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: 'MO',
    zip: '',
    phone: '',
    website: '',
    notes: '',
    zone_id: '',
    day_of_week: '1',
    week_number: '1',
    location_number: 1
  })

  useEffect(() => {
    fetchZones()
  }, [])

  async function fetchZones() {
    const { fetchActiveZones } = await import('@/lib/frm/utils/fetchActiveZones')
    const { data, error } = await fetchActiveZones(supabase)

    if (error) {
      console.error('Error fetching zones:', error)
      toast.error('Failed to load zones')
    } else {
      setZones(data || [])
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function geocodeAddress() {
    const address = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zip}`

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()

      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location
        return {
          latitude: location.lat,
          longitude: location.lng
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error)
    }

    return { latitude: null, longitude: null }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.city || !formData.state) {
        toast.error('Please fill in all required fields')
        setLoading(false)
        return
      }

      // Geocode the address
      const { latitude, longitude } = await geocodeAddress()

      // Insert agency
      const { data: newAgency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: formData.name,
          address: formData.address || null,
          city: formData.city,
          state: formData.state,
          zip: formData.zip || null,
          phone: formData.phone || null,
          website: formData.website || null,
          notes: formData.notes || null,
          latitude,
          longitude,
          location_number: formData.location_number
        })
        .select()
        .single()

      if (agencyError) throw agencyError

      // If zone is selected, create zone assignment
      if (formData.zone_id) {
        const { error: zoneError } = await supabase
          .from('zone_assignments')
          .insert({
            zone_id: formData.zone_id,
            agency_id: newAgency.id,
            day_of_week: parseInt(formData.day_of_week),
            week_number: parseInt(formData.week_number),
            sequence_order: 999 // Will need to be updated in route planning
          })

        if (zoneError) {
          console.error('Zone assignment error:', zoneError)
          toast.error('Agency created but zone assignment failed')
        }
      }

      toast.success('Agency added successfully!')
      router.push('/marketing/frm/agency-lookup')
    } catch (error) {
      console.error('Error adding agency:', error)
      toast.error('Failed to add agency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold" style={{ color: '#9D2235' }}>
              Add New Agency
            </h1>
            <p className="text-gray-600 mt-2">
              Enter agency information and assign to a zone
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Agency Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agency Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., State Farm - John Smith"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123 Main St"
              />
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Springfield"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MO">Missouri</option>
                  <option value="IL">Illinois</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  name="zip"
                  value={formData.zip}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="65804"
                  maxLength="10"
                />
              </div>
            </div>

            {/* Phone & Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(417) 555-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Location Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Number
              </label>
              <input
                type="number"
                name="location_number"
                value={formData.location_number}
                onChange={handleInputChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                For multi-location agencies (e.g., Location 1, Location 2)
              </p>
            </div>

            {/* Zone Assignment */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Zone Assignment (Optional)</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zone
                  </label>
                  <select
                    name="zone_id"
                    value={formData.zone_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No zone (assign later)</option>
                    {zones.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        Zone {zone.zone_number} - {zone.zone_name}
                        {zone.custom_name && ` (${zone.custom_name})`}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.zone_id && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of Week
                      </label>
                      <select
                        name="day_of_week"
                        value={formData.day_of_week}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Week Number
                      </label>
                      <select
                        name="week_number"
                        value={formData.week_number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1">Week 1</option>
                        <option value="2">Week 2</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional information about this agency..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-white rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: '#9D2235' }}
              >
                {loading ? 'Adding Agency...' : 'Add Agency'}
              </button>
            </div>
          </form>
        </div>
    </AppShell>
  )
}
