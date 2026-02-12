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

    const { name, address, city, state, zip } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Agency name is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    // Build search query - agency name + location
    const locationQuery = [address, city, state, zip].filter(Boolean).join(', ')
    const searchQuery = `${name} ${locationQuery}`

    console.log('Google Places search query:', searchQuery)

    // Use Google Places Text Search (New)
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText'

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount'
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 1
      })
    })

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      console.error('Google Places API error:', searchResponse.status, errorText)
      return NextResponse.json({
        success: false,
        error: `Places API error: ${searchResponse.status}`
      })
    }

    const searchData = await searchResponse.json()
    console.log('Google Places response:', JSON.stringify(searchData, null, 2))

    // Check if we got results
    if (!searchData.places || searchData.places.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No business found matching this agency'
      })
    }

    const place = searchData.places[0]

    return NextResponse.json({
      success: true,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
      website: place.websiteUri || '',
      rating: place.rating || null,
      ratingCount: place.userRatingCount || null,
      businessStatus: place.businessStatus || 'UNKNOWN'
    })

  } catch (error) {
    console.error('Places lookup error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
