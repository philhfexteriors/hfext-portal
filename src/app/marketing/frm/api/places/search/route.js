import { createClient } from '@/lib/supabase/frm-server'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

async function performSingleSearch(apiKey, searchQuery) {
  const searchUrl = 'https://places.googleapis.com/v1/places:searchText'

  const searchResponse = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,places.location,places.addressComponents'
    },
    body: JSON.stringify({
      textQuery: searchQuery,
      maxResultCount: 20
    })
  })

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text()
    console.error('Google Places API error:', searchResponse.status, errorText)
    return []
  }

  const searchData = await searchResponse.json()
  return searchData.places || []
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { location, radius, comprehensive } = await request.json()

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    console.log('Searching for insurance agencies near:', location, 'radius:', radius, 'comprehensive:', comprehensive !== false)

    const radiusText = radius ? ` within ${radius} miles` : ''

    // Multiple search queries focused on residential property insurance
    const searchQueries = [
      `home insurance agency in ${location}${radiusText}`,
      `homeowners insurance agent in ${location}${radiusText}`,
      `State Farm insurance in ${location}${radiusText}`,
      `Allstate insurance in ${location}${radiusText}`,
      `Farmers insurance in ${location}${radiusText}`,
      `Liberty Mutual insurance in ${location}${radiusText}`,
      `Nationwide insurance in ${location}${radiusText}`,
      `American Family insurance in ${location}${radiusText}`,
      `Auto-Owners insurance in ${location}${radiusText}`,
      `Shelter insurance in ${location}${radiusText}`,
      `Farm Bureau insurance in ${location}${radiusText}`
    ]

    console.log('Running comprehensive search with', searchQueries.length, 'queries in parallel')

    // Run all searches in parallel for ~10x speedup
    const results = await Promise.all(
      searchQueries.map((query, i) => {
        console.log(`Query ${i + 1}/${searchQueries.length}:`, query)
        return performSingleSearch(apiKey, query)
      })
    )
    const allPlaces = results.flat()
    console.log('Total results from all queries:', allPlaces.length)

    console.log('Total places found before deduplication:', allPlaces.length)

    // Deduplicate places based on name + address
    const seenPlaces = new Map()
    const uniquePlaces = []

    for (const place of allPlaces) {
      const name = place.displayName?.text?.toLowerCase().trim() || ''
      const address = place.formattedAddress?.toLowerCase().trim() || ''
      const key = `${name}|${address}`

      if (!seenPlaces.has(key) && name) {
        seenPlaces.set(key, true)
        uniquePlaces.push(place)
      }
    }

    console.log('Unique places after deduplication:', uniquePlaces.length)

    // Check if we got results
    if (uniquePlaces.length === 0) {
      return NextResponse.json({
        success: true,
        agencies: [],
        message: 'No insurance agencies found in this area'
      })
    }

    // Parse and format the results
    const agencies = uniquePlaces.map(place => {
      // Extract address components
      const components = place.addressComponents || []
      const streetNumber = components.find(c => c.types?.includes('street_number'))?.longText || ''
      const route = components.find(c => c.types?.includes('route'))?.longText || ''
      const city = components.find(c => c.types?.includes('locality'))?.longText || ''
      const state = components.find(c => c.types?.includes('administrative_area_level_1'))?.shortText || ''
      const zip = components.find(c => c.types?.includes('postal_code'))?.longText || ''

      const street = `${streetNumber} ${route}`.trim()

      return {
        name: place.displayName?.text || '',
        address: street || place.formattedAddress || '',
        city: city,
        state: state,
        zip: zip,
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
        website: place.websiteUri || '',
        rating: place.rating || null,
        ratingCount: place.userRatingCount || null,
        businessStatus: place.businessStatus || 'UNKNOWN',
        latitude: place.location?.latitude || null,
        longitude: place.location?.longitude || null,
        formattedAddress: place.formattedAddress || ''
      }
    })

    return NextResponse.json({
      success: true,
      agencies: agencies,
      count: agencies.length
    })

  } catch (error) {
    console.error('Territory search error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
