'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { hapticLight } from '@/lib/frm/utils/haptics'
import Image from 'next/image'
import { isAdmin as checkAdmin } from '@/lib/frm/auth/roles'

const BASE = '/marketing/frm'

const mainNav = [
  { href: '', label: 'Home', adminLabel: 'Dashboard', icon: '📊' },
  { href: '/my-stats', label: 'My Stats', icon: '📈', frmOnly: true },
  { href: '/agency-lookup', label: 'Agency Lookup', icon: '🔍' },
  { href: '/log-visit', label: 'Log Visit', icon: '📝' },
  { href: '/plan-day', label: 'Plan Day', icon: '📅' },
]

const dataNav = [
  { href: '/data-entry', label: 'Data Entry', icon: '✏️' },
  { href: '/data-cleanup', label: 'Data Cleanup', icon: '🧹' },
  { href: '/phone-lookup', label: 'Phone Lookup', icon: '📞' },
  { href: '/territory-search', label: 'Territory Search', icon: '🗺️' },
  { href: '/notes-search', label: 'Notes Search', icon: '🔎' },
  { href: '/zone-map', label: 'Zone Map', icon: '📍' },
  { href: '/unassigned-agencies', label: 'Unassigned Agencies', icon: '🏢' },
  { href: '/data-cleanup/addresses', label: 'Address Validation', icon: '📬' },
  { href: '/data-cleanup/agencies', label: 'Agency Duplicates', icon: '👥' },
  { href: '/data-cleanup/contacts', label: 'Contact Duplicates', icon: '👤' },
]

const adminNavItems = [
  { href: '/admin/route-planning', label: 'Route Planning', icon: '🛣️' },
  { href: '/admin/geocoding', label: 'Geocoding', icon: '🌐' },
  { href: '/admin/email-test', label: 'Email Test', icon: '📧' },
  { href: '/analytics/heatmap', label: 'Visit Heatmap', icon: '🔥' },
  { href: '/admin/zones', label: 'Zone Management', icon: '🗂️' },
]

function frmHref(path) {
  return path === '' ? BASE : `${BASE}${path}`
}

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hasActiveDay, setHasActiveDay] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('auto')
  const [dataOpen, setDataOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const supabase = createClient()
  const isAdmin = checkAdmin(user?.email)

  // Initialize collapsible sections based on current path
  useEffect(() => {
    const isDataPage = dataNav.some(item => pathname === frmHref(item.href) || pathname.startsWith(frmHref(item.href) + '/'))
    const isAdminPage = adminNavItems.some(item => pathname === frmHref(item.href) || pathname.startsWith(frmHref(item.href) + '/'))
    if (isDataPage) setDataOpen(true)
    if (isAdminPage) setAdminOpen(true)
  }, [pathname])

  // Load viewMode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('frm_viewMode')
    if (saved) {
      setViewMode(saved)
    }
  }, [])

  // Handle view mode toggle
  const toggleViewMode = () => {
    hapticLight()
    const newMode = viewMode === 'admin' ? 'frm' : 'admin'
    localStorage.setItem('frm_viewMode', newMode)
    setViewMode(newMode)
    window.location.reload()
  }

  // Check if FRM has an active day in progress
  useEffect(() => {
    const checkActiveDay = async () => {
      if (user && !isAdmin) {
        try {
          const { data: frmData, error: frmError } = await supabase
            .from('frms')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          if (frmError) {
            console.error('Error fetching FRM:', frmError)
          }

          if (frmData) {
            const { data: progress, error: progressError } = await supabase
              .from('frm_progress')
              .select('current_zone_id, current_day_of_week')
              .eq('frm_id', frmData.id)
              .maybeSingle()

            if (progressError) {
              console.error('Error fetching progress:', progressError)
            }

            setHasActiveDay(!!(progress?.current_zone_id && progress?.current_day_of_week))
          }
        } catch (error) {
          console.error('Error checking active day:', error)
        }
      }
      setLoading(false)
    }

    checkActiveDay()
  }, [user, isAdmin])

  const isActive = (href) => {
    const fullHref = frmHref(href)
    if (href === '') return pathname === BASE
    return pathname === fullHref || pathname.startsWith(fullHref + '/')
  }

  const navLinkClasses = (href) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-primary/10 text-primary'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  const handleLinkClick = () => {
    hapticLight()
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Brand Header with Back to Portal */}
      <div className="p-4 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mb-2 transition-colors" onClick={handleLinkClick}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Portal
        </Link>
        <Link href={BASE} className="flex items-center gap-3" onClick={handleLinkClick}>
          <Image
            src="/hf-logo.png"
            alt="H&F Exteriors"
            width={120}
            height={40}
            className="h-8 w-auto"
            priority
          />
          <span className="text-xs font-medium text-gray-400">FRM</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNav
          .filter(item => {
            if (item.frmOnly && isAdmin && viewMode === 'admin') return false
            return true
          })
          .map(item => (
            <Link
              key={item.href}
              href={frmHref(item.href)}
              className={navLinkClasses(item.href)}
              onClick={handleLinkClick}
            >
              <span className="text-base">{item.icon}</span>
              <span>
                {item.href === ''
                  ? (isAdmin && viewMode === 'admin' ? item.adminLabel : item.label)
                  : item.label}
              </span>
            </Link>
          ))}

        {/* Today link (FRM only, when active day exists) */}
        {!isAdmin && hasActiveDay && (
          <Link
            href={frmHref('/today')}
            className={navLinkClasses('/today')}
            onClick={handleLinkClick}
          >
            <span className="text-base">📋</span>
            <span>Today</span>
          </Link>
        )}

        {/* Data Section (collapsible) */}
        <div className="pt-3 mt-3 border-t border-gray-200">
          <button
            onClick={() => { hapticLight(); setDataOpen(!dataOpen) }}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            <span>Data</span>
            <svg
              className={`w-4 h-4 transition-transform ${dataOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dataOpen && (
            <div className="space-y-1 mt-1">
              {dataNav.map(item => (
                <Link
                  key={item.href}
                  href={frmHref(item.href)}
                  className={navLinkClasses(item.href)}
                  onClick={handleLinkClick}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Admin Section (collapsible, admin only) */}
        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-gray-200">
            <button
              onClick={() => { hapticLight(); setAdminOpen(!adminOpen) }}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
            >
              <span>Admin</span>
              <svg
                className={`w-4 h-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {adminOpen && (
              <div className="space-y-1 mt-1">
                {adminNavItems.map(item => (
                  <Link
                    key={item.href}
                    href={frmHref(item.href)}
                    className={navLinkClasses(item.href)}
                    onClick={handleLinkClick}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-gray-200">
        {/* View mode toggle (admin only) */}
        {isAdmin && (
          <button
            onClick={toggleViewMode}
            className="w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-lg text-sm font-medium border-2 border-gray-200 hover:border-primary text-secondary hover:text-primary transition-colors"
            title={`Switch to ${viewMode === 'admin' ? 'FRM' : 'Admin'} view`}
          >
            <span className="text-base">{viewMode === 'admin' ? '🛡️' : '👤'}</span>
            <span>{viewMode === 'admin' ? 'Admin View' : 'FRM View'}</span>
          </button>
        )}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-medium">
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
            title="Sign out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => { hapticLight(); setMobileOpen(!mobileOpen) }}
          className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/hf-logo.png"
            alt="H&F Exteriors"
            width={100}
            height={32}
            className="h-7 w-auto"
            priority
          />
          <span className="text-xs font-medium text-gray-400">FRM</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={toggleViewMode}
              className="text-xs font-medium text-secondary hover:text-primary transition-colors px-2 py-1 rounded border border-gray-300"
              title={`Switch to ${viewMode === 'admin' ? 'FRM' : 'Admin'} view`}
            >
              {viewMode === 'admin' ? '🛡️' : '👤'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
