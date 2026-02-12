'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { getGoogleMapsDirectionsUrl } from '@/lib/frm/utils/maps'
import { formatDistance } from '@/lib/frm/utils/distance'
import { format } from 'date-fns'
import { hapticLight, hapticSuccess } from '@/lib/frm/utils/haptics'
import { useDraftSave } from '@/lib/frm/hooks/useDraftSave'
import VoiceInput from './VoiceInput'
import toast from 'react-hot-toast'

export default function AgencyCard({
  agency,
  sequenceNumber,
  distanceToNext,
  lastVisit,
  isVisited,
  onVisitLogged,
  frmId
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [visitNotes, setVisitNotes, clearNotesDraft, draftSaved] = useDraftSave(`agencyDraft_${agency.id}`)
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [visitHistory, setVisitHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const supabase = createClient()

  const handleExpand = async () => {
    hapticLight()
    if (!isExpanded && visitHistory.length === 0) {
      // Load visit history when expanding for the first time
      await fetchVisitHistory()
    }
    setIsExpanded(!isExpanded)
  }

  const fetchVisitHistory = async () => {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          conversation_notes,
          frms (name)
        `)
        .eq('agency_id', agency.id)
        .order('visit_date', { ascending: false })
        .limit(5)

      if (error) throw error
      setVisitHistory(data || [])
    } catch (error) {
      console.error('Error fetching visit history:', error)
      toast.error('Failed to load visit history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleLogVisit = async () => {
    if (!visitDate || !frmId) {
      toast.error('Missing required fields')
      return
    }

    setIsLogging(true)
    try {
      const { data, error } = await supabase
        .from('visits')
        .insert({
          frm_id: frmId,
          agency_id: agency.id,
          visit_date: visitDate,
          conversation_notes: visitNotes || null
        })
        .select()
        .single()

      if (error) throw error

      hapticSuccess()
      toast.success('Visit logged successfully!')

      // Clear draft from localStorage
      clearNotesDraft()
      setIsExpanded(false)

      // Trigger callback to parent component
      if (onVisitLogged) {
        onVisitLogged(agency.id, sequenceNumber)
      }

    } catch (error) {
      console.error('Error logging visit:', error)
      toast.error('Failed to log visit')
    } finally {
      setIsLogging(false)
    }
  }

  const handleGetDirections = () => {
    hapticLight()
    const url = getGoogleMapsDirectionsUrl(agency.latitude, agency.longitude)
    // Use window.location.href instead of window.open to avoid blank tabs on mobile
    window.location.href = url
  }

  // Format address
  const fullAddress = `${agency.address}, ${agency.city}, ${agency.state} ${agency.zip}`

  return (
    <div className={`bg-white rounded-lg shadow-md border-2 transition-all ${
      isVisited ? 'border-green-500' : 'border-gray-200'
    } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Collapsed State - Always Visible */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Sequence & Info */}
          <div className="flex-1 min-w-0">
            {/* Sequence Number */}
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#9D2235] text-white text-sm font-bold">
                {sequenceNumber}
              </span>
              {isVisited && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Visited
                </span>
              )}
            </div>

            {/* Agency Name */}
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {agency.name}
            </h3>

            {/* Address */}
            <p className="text-sm text-gray-600 mb-2">{fullAddress}</p>

            {/* Last Visit Preview */}
            {lastVisit && (
              <div className="text-xs text-gray-500 mb-2">
                <span className="font-medium">Last visit: </span>
                {format(new Date(lastVisit.visit_date), 'MMM d, yyyy')}
                {lastVisit.conversation_notes && (
                  <span className="ml-2 italic">
                    "{lastVisit.conversation_notes.substring(0, 50)}
                    {lastVisit.conversation_notes.length > 50 ? '...' : ''}"
                  </span>
                )}
              </div>
            )}

            {/* Distance to Next */}
            {distanceToNext !== null && distanceToNext !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span>{formatDistance(distanceToNext)} to next</span>
              </div>
            )}
          </div>

          {/* Right: Expand Icon */}
          <div className="flex-shrink-0">
            <svg
              className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded State */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Full Agency Details */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Contact Information</h4>
            <div className="space-y-1 text-sm">
              {agency.phone && (
                <div>
                  <span className="text-gray-600">Phone: </span>
                  <a href={`tel:${agency.phone}`} className="text-blue-600 hover:underline">
                    {agency.phone}
                  </a>
                </div>
              )}
              <div>
                <span className="text-gray-600">Address: </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {fullAddress}
                </a>
              </div>
            </div>
          </div>

          {/* Get Directions Button */}
          <button
            onClick={handleGetDirections}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Get Directions
          </button>

          {/* Visit History */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Visits</h4>
            {loadingHistory ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : visitHistory.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {visitHistory.map(visit => (
                  <div key={visit.id} className="bg-gray-50 p-2 rounded text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-700">
                        {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                      </span>
                      <span className="text-xs text-gray-500">{visit.frms?.name}</span>
                    </div>
                    {visit.conversation_notes && (
                      <p className="text-gray-600 italic">{visit.conversation_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No previous visits</p>
            )}
          </div>

          {/* Inline Quick-Log Form (only if not visited) */}
          {!isVisited && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Log Visit</h4>
              <div className="space-y-3">
                {/* Visit Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visit Date
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Visit Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                    {draftSaved && (
                      <span className="ml-2 text-xs text-green-600 transition-opacity">
                        ✓ Draft saved
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <textarea
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      rows={3}
                      placeholder="Enter visit notes..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    />
                    <div className="absolute right-2 bottom-2">
                      <VoiceInput
                        onTranscript={(transcript) => {
                          setVisitNotes(prev => prev ? `${prev} ${transcript}` : transcript)
                        }}
                        disabled={isLogging}
                      />
                    </div>
                  </div>
                </div>

                {/* Log Visit Button */}
                <button
                  onClick={handleLogVisit}
                  disabled={isLogging || !visitDate}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLogging ? 'Logging Visit...' : 'Log Visit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
