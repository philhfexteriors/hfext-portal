import { createClient } from '@/lib/supabase/frm-server'
import { extractTextFromImage, parseContactFromOCR } from '@/lib/services/frm/ocrParser'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file')
    const visitId = formData.get('visitId')
    const runOCR = formData.get('runOCR') === 'true'

    if (!file || !visitId) {
      return NextResponse.json({ error: 'Missing file or visitId' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, and HEIC are allowed.' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const fileName = `${visitId}_${timestamp}.${fileExt}`
    const filePath = `visit-photos/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('visit-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('visit-photos')
      .getPublicUrl(filePath)

    // Run OCR if requested and API key is available
    let ocrText = null
    let parsedContact = null

    if (runOCR && process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      try {
        ocrText = await extractTextFromImage(buffer, process.env.GOOGLE_CLOUD_VISION_API_KEY)
        if (ocrText) {
          parsedContact = parseContactFromOCR(ocrText)
        }
      } catch (ocrError) {
        console.error('OCR error:', ocrError)
        // Don't fail the upload if OCR fails, just log it
      }
    }

    // Save attachment record to database
    const { data: attachmentData, error: dbError } = await supabase
      .from('visit_attachments')
      .insert({
        visit_id: visitId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        ocr_extracted_text: ocrText,
        ocr_parsed_data: parsedContact,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to clean up uploaded file
      await supabase.storage.from('visit-photos').remove([filePath])
      return NextResponse.json({ error: 'Failed to save attachment: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      attachment: attachmentData,
      ocrText,
      parsedContact
    })

  } catch (error) {
    console.error('Upload error:', error)
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}
