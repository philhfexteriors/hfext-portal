'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import toast from 'react-hot-toast'
import { hapticSuccess, hapticLight } from '@/lib/frm/utils/haptics'

export default function PhotoUpload({ visitId, onUploadComplete, onContactExtracted }) {
  const [uploading, setUploading] = useState(false)
  const [showBusinessCardModal, setShowBusinessCardModal] = useState(false)
  const supabase = createClient()

  async function handleFileSelect(e, isBusinessCard = false) {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, and HEIC images are supported')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB')
      return
    }

    setUploading(true)
    hapticLight()

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('visitId', visitId)
      formData.append('runOCR', isBusinessCard ? 'true' : 'false')

      // Upload via API
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      hapticSuccess()

      if (isBusinessCard && result.parsedContact) {
        // Show the parsed contact data
        toast.success('Business card scanned! Review the extracted information.')
        if (onContactExtracted) {
          onContactExtracted(result.parsedContact, result.ocrText, result.attachment.id)
        }
      } else {
        toast.success('Photo uploaded successfully')
      }

      if (onUploadComplete) {
        onUploadComplete(result.attachment)
      }

      setShowBusinessCardModal(false)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload photo')
    } finally {
      setUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  function openBusinessCardUpload() {
    setShowBusinessCardModal(true)
  }

  function closeBusinessCardModal() {
    setShowBusinessCardModal(false)
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {/* Regular photo upload */}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/heic"
            onChange={(e) => handleFileSelect(e, false)}
            disabled={uploading}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {uploading ? 'Uploading...' : 'Add Photo'}
          </label>
        </div>

        {/* Business card upload */}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/heic"
            onChange={(e) => handleFileSelect(e, true)}
            disabled={uploading}
            className="hidden"
            id="business-card-upload"
          />
          <label
            htmlFor="business-card-upload"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
            {uploading ? 'Scanning...' : 'Scan Business Card'}
          </label>
        </div>
      </div>

      {uploading && (
        <div className="mt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Uploading and processing...</span>
          </div>
        </div>
      )}
    </>
  )
}
