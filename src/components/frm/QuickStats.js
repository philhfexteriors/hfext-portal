'use client'

import { useMemo } from 'react'

export default function QuickStats({ visits, allTimeCount }) {
  const stats = useMemo(() => {
    if (!visits.length) return { today: 0, week: 0, year: 0, total: allTimeCount || 0, avgPerWeek: 0 }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const todayVisits = visits.filter(v =>
      new Date(v.visit_date) >= today
    ).length

    const weekVisits = visits.filter(v =>
      new Date(v.visit_date) >= weekStart
    ).length

    const yearVisits = visits.filter(v =>
      new Date(v.visit_date) >= yearStart
    ).length

    const weeksInYear = Math.ceil((now - yearStart) / (7 * 24 * 60 * 60 * 1000))
    const avgPerWeek = weeksInYear > 0 ? (yearVisits / weeksInYear).toFixed(1) : 0

    return {
      today: todayVisits,
      week: weekVisits,
      year: yearVisits,
      total: allTimeCount || visits.length,
      avgPerWeek
    }
  }, [visits, allTimeCount])

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">Quick Visit Stats</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Today" value={stats.today} sublabel="So far..." />
        <StatCard label="This Week" value={stats.week} sublabel="Week to Date" />
        <StatCard label="Avg Visits/Week" value={stats.avgPerWeek} sublabel="per selection" />
        <StatCard label="This Year" value={stats.year} sublabel="Year to Date" />
        <StatCard label="All-time" value={stats.total} sublabel="Total" />
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel }) {
  // Format numbers with commas for readability
  const formattedValue = typeof value === 'number' && Number.isInteger(value)
    ? value.toLocaleString()
    : value

  return (
    <div className="border rounded-lg p-3">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{formattedValue}</div>
      <div className="text-xs text-gray-500">{sublabel}</div>
    </div>
  )
}