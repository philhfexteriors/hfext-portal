import { createClient } from '@/lib/supabase/frm-server'
import { isAdmin } from '@/lib/frm/auth/roles'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()

  // Verify admin user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Fetch all agencies that need geocoding
    // Include agencies that failed previously (have geocode_error set)
    const { data: agencies, error: fetchError } = await supabase
      .from('agencies')
      .select('id, name, address, city, state, zip, geocode_error')
      .or('geocoded.eq.false,geocoded.is.null,latitude.is.null')

    if (fetchError) {
      throw fetchError
    }

    if (!agencies || agencies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All agencies already geocoded',
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: []
      })
    }

    const results = []
    let succeeded = 0
    let failed = 0

    // Process each agency with rate limiting
    for (let i = 0; i < agencies.length; i++) {
      const agency = agencies[i]

      // Build full address
      const fullAddress = `${agency.address || ''}, ${agency.city || ''}, ${agency.state || ''} ${agency.zip || ''}`.trim()

      if (!fullAddress || fullAddress === ', ,' || fullAddress.length < 5) {
        // Skip agencies with insufficient address data
        results.push({
          agencyId: agency.id,
          agencyName: agency.name,
          success: false,
          error: 'Insufficient address data'
        })
        failed++
        continue
      }

      try {
        // Call Geocodio API directly
        const apiKey = process.env.GEOCODIO_API_KEY

        if (!apiKey) {
          console.error('GEOCODIO_API_KEY not found in environment')
          throw new Error('Geocodio API key not configured')
        }

        const geocodioUrl = `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(fullAddress)}&api_key=${apiKey}`

        console.log('Calling Geocodio for:', agency.name, fullAddress)

        const geocodioResponse = await fetch(geocodioUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!geocodioResponse.ok) {
          const errorText = await geocodioResponse.text()
          console.error('Geocodio error response:', geocodioResponse.status, errorText)
          throw new Error(`Geocodio API error: ${geocodioResponse.status} - ${errorText}`)
        }

        const geocodioData = await geocodioResponse.json()
        if (!geocodioData.results || geocodioData.results.length === 0) {
          throw new Error('No coordinates returned from geocoding service')
        }

        const latitude = geocodioData.results[0].location.lat
        const longitude = geocodioData.results[0].location.lng

        if (!latitude || !longitude) {
          throw new Error('Invalid coordinates returned')
        }

        // Update agency with geocoding data
        const { error: updateError } = await supabase
          .from('agencies')
          .update({
            latitude,
            longitude,
            geocoded: true,
            geocoded_at: new Date().toISOString(),
            geocode_error: null
          })
          .eq('id', agency.id)

        if (updateError) {
          throw updateError
        }

        results.push({
          agencyId: agency.id,
          agencyName: agency.name,
          success: true,
          latitude,
          longitude
        })
        succeeded++

      } catch (error) {
        // Log error and continue
        const errorMessage = error.message || 'Unknown error'

        // Update agency with error
        await supabase
          .from('agencies')
          .update({
            geocoded: false,
            geocode_error: errorMessage
          })
          .eq('id', agency.id)

        results.push({
          agencyId: agency.id,
          agencyName: agency.name,
          success: false,
          error: errorMessage
        })
        failed++
      }

      // Rate limiting: Geocodio allows 60 requests per minute on free tier
      // Add 1000ms (1 second) delay between requests to be safe (60/min = 1 per second)
      if (i < agencies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${agencies.length} agencies: ${succeeded} succeeded, ${failed} failed`,
      processed: agencies.length,
      succeeded,
      failed,
      results
    })

  } catch (error) {
    console.error('Batch geocoding error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Batch geocoding failed', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check geocoding status
export async function GET(request) {
  const supabase = await createClient()

  // Verify admin user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('agencies')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // Get geocoded count
    const { count: geocodedCount, error: geocodedError } = await supabase
      .from('agencies')
      .select('*', { count: 'exact', head: true })
      .eq('geocoded', true)

    if (geocodedError) throw geocodedError

    // Get failed count
    const { count: failedCount, error: failedError } = await supabase
      .from('agencies')
      .select('*', { count: 'exact', head: true })
      .not('geocode_error', 'is', null)

    if (failedError) throw failedError

    // Get ungecoded agencies (including those that failed)
    const { data: ungeocoded, error: ungeocodedError } = await supabase
      .from('agencies')
      .select('id, name, address, city, state, zip, geocode_error')
      .or('geocoded.eq.false,geocoded.is.null,latitude.is.null')
      .limit(100)

    if (ungeocodedError) throw ungeocodedError

    return NextResponse.json({
      total: totalCount || 0,
      geocoded: geocodedCount || 0,
      ungecoded: (totalCount || 0) - (geocodedCount || 0),
      failed: failedCount || 0,
      ungeocodedAgencies: ungeocoded || []
    })

  } catch (error) {
    console.error('Geocoding status error:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Failed to fetch geocoding status', details: error.message },
      { status: 500 }
    )
  }
}
