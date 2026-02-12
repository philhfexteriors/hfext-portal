'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'
import toast from 'react-hot-toast'

export default function ManageZones() {
  const supabase = createClient()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingZone, setEditingZone] = useState(null)
  const [customName, setCustomName] = useState('')

  useEffect(() => {
    fetchZones()
  }, [])

  async function fetchZones() {
    try {
      const { fetchActiveZones } = await import('@/lib/frm/utils/fetchActiveZones')
      const { data, error } = await fetchActiveZones(supabase)

      if (error) throw error
      setZones(data || [])
    } catch (err) {
      console.error('Error fetching zones:', err)
      toast.error('Failed to load zones')
    } finally {
      setLoading(false)
    }
  }

  async function updateZoneName(zoneId) {
    try {
      const { error } = await supabase
        .from('route_zones')
        .update({ custom_name: customName || null })
        .eq('id', zoneId)

      if (error) throw error

      toast.success('Zone name updated!')
      setEditingZone(null)
      setCustomName('')
      fetchZones()
    } catch (err) {
      console.error('Error updating zone:', err)
      toast.error('Failed to update zone name')
    }
  }

  function startEditing(zone) {
    setEditingZone(zone.id)
    setCustomName(zone.custom_name || '')
  }

  if (loading) {
    return (
      <AppShell fullWidth>
      <div className="p-4 max-w-4xl mx-auto">
            <div className="py-8"><Loading /></div>
          </div>
      </AppShell>
    )
  }

  return (
    <AppShell fullWidth>
      <div className="p-4 max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#9D2235' }}>
            Manage Zones
          </h1>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <p className="text-sm text-gray-600 mb-4">
              Give your zones custom names to make them easier to identify.
              These names will appear alongside the Zone A/B designation throughout the app.
            </p>
            <p className="text-xs text-gray-500">
              Examples: "Downtown", "North Side", "West County", "Metro Area"
            </p>
          </div>

          <div className="space-y-3">
            {zones.map(zone => (
              <div key={zone.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg">
                        Zone {zone.zone_number}
                      </span>
                      <span className="text-sm px-2 py-1 bg-gray-100 rounded">
                        {zone.zone_name}
                      </span>
                    </div>

                    {editingZone === zone.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="Enter custom name (optional)"
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updateZoneName(zone.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingZone(null)
                            setCustomName('')
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          {zone.custom_name ? (
                            <div className="text-lg font-medium" style={{ color: '#9D2235' }}>
                              {zone.custom_name}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400 italic">
                              No custom name set
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => startEditing(zone)}
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          {zone.custom_name ? 'Edit' : 'Add Name'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </AppShell>
  )
}
