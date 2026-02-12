import { createClient } from '@/lib/supabase/frm-server'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const apiKey = process.env.GEOCODIO_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Geocodio API key not configured' }, { status: 500 })
    }

    // Call Geocodio API
    const url = `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(address)}&api_key=${apiKey}`
    console.log('Geocoding address:', address)

    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geocodio API error:', response.status, errorText)
      return NextResponse.json({
        success: false,
        error: `Geocoding API returned ${response.status}`
      })
    }

    const data = await response.json()

    // Check if we got results
    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No results found for this address'
      })
    }

    // Get the best match (first result)
    const result = data.results[0]
    const components = result.address_components || {}

    // Handle missing components gracefully
    const street = components.number && components.street
      ? `${components.number} ${components.street} ${components.suffix || ''}`.trim()
      : components.formatted_street || ''

    return NextResponse.json({
      success: true,
      formatted_address: result.formatted_address || '',
      latitude: result.location?.lat || null,
      longitude: result.location?.lng || null,
      street: street,
      city: components.city || '',
      state: components.state || '',
      zip: components.zip || '',
      accuracy: result.accuracy,
      confidence: result.accuracy_type
    })

  } catch (error) {
    console.error('Geocoding error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
