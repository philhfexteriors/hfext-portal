'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import AppShell from '@/components/frm/AppShell'
import QuickStats from '@/components/frm/QuickStats'
import AgencyFrequency from '@/components/frm/AgencyFrequency'
import RecentVisits from '@/components/frm/RecentVisits'
import FRMBreakdown from '@/components/frm/FRMBreakdown'
import FRMFilters from '@/components/frm/FRMFilters'
import Loading from '@/components/frm/Loading'
import ErrorMessage from '@/components/frm/ErrorMessage'
import FRMHomepage from '@/components/frm/FRMHomepage'
import { useAuth } from '@/components/AuthProvider'
import { isAdmin as checkAdmin } from '@/lib/frm/auth/roles'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { user } = useAuth()
  const supabase = createClient()

  const [isAdmin, setIsAdmin] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)
  const [viewMode, setViewMode] = useState('auto') // 'auto', 'admin', 'frm'

  const [visits, setVisits] = useState([])
  const [allTimeVisitsCount, setAllTimeVisitsCount] = useState(0)
  const [allVisitsForFrequency, setAllVisitsForFrequency] = useState([])
  const [agencies, setAgencies] = useState([])
  const [frms, setFRMs] = useState([])
  const [selectedFRMs, setSelectedFRMs] = useState([])
  const [activeFRMsOnly, setActiveFRMsOnly] = useState(false)
  const [myVisitsOnly, setMyVisitsOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check user role on mount
  useEffect(() => {
    if (user) {
      const adminCheck = checkAdmin(user.email)
      setIsAdmin(adminCheck)
      setRoleLoading(false)

      // Load saved view mode from localStorage
      const savedViewMode = localStorage.getItem('viewMode')
      if (savedViewMode && adminCheck) {
        setViewMode(savedViewMode)
      }

      // Only fetch data if admin and in admin view
      if (adminCheck && (savedViewMode === 'admin' || savedViewMode === 'auto' || !savedViewMode)) {
        fetchData()
      }
    }
  }, [user])

  // Fetch data when filters change (admin only, in admin view)
  useEffect(() => {
    if (user && isAdmin && viewMode === 'admin') {
      fetchData()
    }
  }, [selectedFRMs, activeFRMsOnly, myVisitsOnly])

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      console.log('User authenticated:', !!session)
      console.log('User email:', session?.user?.email)

      // Always fetch all FRMs first to see their structure
      const { data: frmsData, error: frmsError } = await supabase
        .from('frms')
        .select('*')
        .order('name')
      if (frmsError) {
        console.error('FRMs query error:', frmsError)
        throw frmsError
      }
      console.log('FRMs loaded:', frmsData?.length || 0)
      console.log('FRM details:', frmsData)
      console.log('First FRM structure:', frmsData?.[0])

      // Filter FRMs based on activeFRMsOnly checkbox
      let filteredFRMs = frmsData || []
      if (activeFRMsOnly && frmsData) {
        // Check if 'active' field exists and filter
        if (frmsData.length > 0 && 'active' in frmsData[0]) {
          filteredFRMs = frmsData.filter(frm => frm.active === true)
          console.log('Filtered to active FRMs:', filteredFRMs)
        } else {
          console.warn('No "active" field found in FRMs table')
        }
      }

      setFRMs(filteredFRMs)

      // Get all-time visits count (not filtered by anything except active FRMs if checked)
      let countQuery = supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })

      if (activeFRMsOnly && frmsData && frmsData.length > 0 && 'active' in frmsData[0]) {
        const activeFRMIds = frmsData.filter(frm => frm.active === true).map(frm => frm.id)
        if (activeFRMIds.length > 0) {
          countQuery = countQuery.in('frm_id', activeFRMIds)
        }
      }

      const { count } = await countQuery
      setAllTimeVisitsCount(count || 0)

      // Fetch ALL visits (minimal data) for accurate agency frequency using pagination
      // We know there are ~10k+ visits, so fetch in batches of 1000
      const allVisitsData = []
      const batchSize = 1000
      let hasMore = true
      let offset = 0

      while (hasMore && offset < count) {
        let batchQuery = supabase
          .from('visits')
          .select('agency_id, frm_id, visit_date, agencies(name)')
          .order('visit_date', { ascending: false })
          .range(offset, offset + batchSize - 1)

        if (activeFRMsOnly && frmsData && frmsData.length > 0 && 'active' in frmsData[0]) {
          const activeFRMIds = frmsData.filter(frm => frm.active === true).map(frm => frm.id)
          if (activeFRMIds.length > 0) {
            batchQuery = batchQuery.in('frm_id', activeFRMIds)
          }
        }

        const { data: batchData, error: batchError } = await batchQuery

        if (batchError) {
          console.error('Error fetching visits batch:', batchError)
          break
        }

        if (batchData && batchData.length > 0) {
          allVisitsData.push(...batchData)
          offset += batchSize
          hasMore = batchData.length === batchSize
        } else {
          hasMore = false
        }
      }

      setAllVisitsForFrequency(allVisitsData)
      console.log('All visits for frequency loaded:', allVisitsData.length)

      let visitsQuery = supabase
        .from('visits')
        .select(`
          *,
          agencies (id, name, city, state),
          frms (id, name, email)
        `)
        .order('visit_date', { ascending: false })

      if (selectedFRMs.length > 0) {
        visitsQuery = visitsQuery.in('frm_id', selectedFRMs)
      }

      // Filter visits to only show active FRMs
      if (activeFRMsOnly && frmsData) {
        if (frmsData.length > 0 && 'active' in frmsData[0]) {
          const activeFRMIds = frmsData.filter(frm => frm.active === true).map(frm => frm.id)
          if (activeFRMIds.length > 0) {
            visitsQuery = visitsQuery.in('frm_id', activeFRMIds)
          }
        }
      }

      if (myVisitsOnly && user) {
        const { data: userFRM } = await supabase
          .from('frms')
          .select('id')
          .eq('email', user.email)
          .single()
        
        if (userFRM) {
          visitsQuery = visitsQuery.eq('frm_id', userFRM.id)
        }
      }

      const { data: visitsData, error: visitsError } = await visitsQuery
      if (visitsError) {
        console.error('Visits query error:', visitsError)
        throw visitsError
      }
      console.log('Visits loaded:', visitsData?.length || 0)
      setVisits(visitsData || [])

      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('*')
      if (agenciesError) {
        console.error('Agencies query error:', agenciesError)
        throw agenciesError
      }
      console.log('Agencies loaded:', agenciesData?.length || 0)
      setAgencies(agenciesData || [])

    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load dashboard data. Please try again.')
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteVisit(visitId) {
    if (!confirm('Are you sure you want to delete this visit?')) return

    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId)

      if (error) throw error

      toast.success('Visit deleted successfully')
      fetchData()
    } catch (err) {
      console.error('Error deleting visit:', err)
      toast.error('Failed to delete visit')
    }
  }

  async function handleEditVisit() {
    // Refresh data after edit
    await fetchData()
  }

  // Determine which view to show
  const shouldShowFRMView = !isAdmin || viewMode === 'frm'
  const shouldShowAdminView = isAdmin && viewMode === 'admin'

  // Show loading while determining role
  if (roleLoading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    )
  }

  // Show FRM homepage
  if (shouldShowFRMView) {
    return (
      <AppShell>
        <FRMHomepage />
      </AppShell>
    )
  }

  // Show admin dashboard
  return (
    <AppShell>
      <h1 className="text-3xl font-bold mb-6 text-primary">FRM Visit Dashboard</h1>

      {error && <ErrorMessage message={error} />}

      <FRMFilters
        frms={frms}
        selectedFRMs={selectedFRMs}
        setSelectedFRMs={setSelectedFRMs}
        activeFRMsOnly={activeFRMsOnly}
        setActiveFRMsOnly={setActiveFRMsOnly}
        myVisitsOnly={myVisitsOnly}
        setMyVisitsOnly={setMyVisitsOnly}
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <QuickStats visits={visits} allTimeCount={allTimeVisitsCount} />
          <AgencyFrequency visits={allVisitsForFrequency.length > 0 ? allVisitsForFrequency : visits} agencies={agencies} />
          <RecentVisits visits={visits} onDelete={handleDeleteVisit} onEdit={handleEditVisit} />
          <FRMBreakdown visits={allVisitsForFrequency.length > 0 ? allVisitsForFrequency : visits} frms={frms} />
        </>
      )}
    </AppShell>
  )
}