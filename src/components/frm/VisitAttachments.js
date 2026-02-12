'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import toast from 'react-hot-toast'

export default function VisitAttachments({ visitId }) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    if (visitId) {
      fetchAttachments()
    }
  }, [visitId])

  async function fetchAttachments() {
    try {
      const { data, error } = await supabase
        .from('visit_attachments')
        .select('*')
        .eq('visit_id', visitId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error

      setAttachments(data || [])
    } catch (err) {
      console.error('Error fetching attachments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function deleteAttachment(attachmentId, filePath) {
    if (!confirm('Delete this photo?')) return

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('visit_attachments')
        .delete()
        .eq('id', attachmentId)

      if (dbError) throw dbError

      // Delete from storage
      const fileName = filePath.split('/').pop()
      await supabase.storage
        .from('visit-photos')
        .remove([`visit-photos/${fileName}`])

      toast.success('Photo deleted')
      fetchAttachments()
    } catch (err) {
      console.error('Error deleting attachment:', err)
      toast.error('Failed to delete photo')
    }
  }

  if (loading) {
    return null
  }

  if (attachments.length === 0) {
    return null
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {attachments.map(attachment => (
          <div key={attachment.id} className="relative group">
            <div
              className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
              onClick={() => setSelectedImage(attachment)}
            >
              <img
                src={attachment.file_url}
                alt={attachment.file_name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteAttachment(attachment.id, attachment.file_url)
              }}
              className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-700"
              title="Delete photo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* OCR badge */}
            {attachment.ocr_parsed_data && (
              <div className="absolute bottom-1 left-1 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                Card
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image modal */}
      {selectedImage && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-75 z-50"
            onClick={() => setSelectedImage(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{selectedImage.file_name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedImage.uploaded_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 max-h-[calc(90vh-200px)] overflow-y-auto">
                <img
                  src={selectedImage.file_url}
                  alt={selectedImage.file_name}
                  className="w-full h-auto"
                />

                {/* Show OCR data if available */}
                {selectedImage.ocr_parsed_data && (
                  <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2">📇 Extracted Contact Info</h4>
                    <div className="space-y-1 text-sm">
                      {selectedImage.ocr_parsed_data.name && (
                        <div><strong>Name:</strong> {selectedImage.ocr_parsed_data.name}</div>
                      )}
                      {selectedImage.ocr_parsed_data.title && (
                        <div><strong>Title:</strong> {selectedImage.ocr_parsed_data.title}</div>
                      )}
                      {selectedImage.ocr_parsed_data.email && (
                        <div><strong>Email:</strong> {selectedImage.ocr_parsed_data.email}</div>
                      )}
                      {selectedImage.ocr_parsed_data.phone && (
                        <div><strong>Phone:</strong> {selectedImage.ocr_parsed_data.phone}</div>
                      )}
                      {selectedImage.ocr_parsed_data.company && (
                        <div><strong>Company:</strong> {selectedImage.ocr_parsed_data.company}</div>
                      )}
                      {selectedImage.ocr_parsed_data.confidence && (
                        <div className="mt-2 text-xs text-gray-600">
                          Confidence: <span className="capitalize">{selectedImage.ocr_parsed_data.confidence}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedImage.ocr_extracted_text && !selectedImage.ocr_parsed_data && (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Extracted Text</h4>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{selectedImage.ocr_extracted_text}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
