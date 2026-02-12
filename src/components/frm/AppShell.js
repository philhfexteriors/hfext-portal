'use client'

import Navigation from '@/components/frm/Navigation'

export default function AppShell({ children, fullWidth = false }) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        {fullWidth ? (
          children
        ) : (
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        )}
      </main>
    </div>
  )
}
