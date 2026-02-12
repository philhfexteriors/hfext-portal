'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/frm-client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'
import AppShell from '@/components/frm/AppShell'
import Loading from '@/components/frm/Loading'

export default function VisitHeatmap() {
  const [visitCounts, setVisitCounts] = useState({})
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedFRMs, setSelectedFRMs] = useState([])
  const [frms, setFRMs] = useState([])
  const supabase = createClient()

  useEffect(() => {
    fetchFRMs()
  }, [])

  useEffect(() => {
    if (frms.length > 0) {
      fetchVisitCounts()
    }
  }, [currentMonth, selectedFRMs, frms])

  async function fetchFRMs() {
    const { data, error } = await supabase
      .from('frms')
      .select('*')
      .order('name')

    if (!error && data) {
      setFRMs(data)
      // Default to all FRMs selected
      setSelectedFRMs(data.map(f => f.id))
    }
  }

  async function fetchVisitCounts() {
    setLoading(true)
    try {
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)

      let query = supabase
        .from('visits')
        .select('visit_date')
        .gte('visit_date', format(start, 'yyyy-MM-dd'))
        .lte('visit_date', format(end, 'yyyy-MM-dd'))

      // Filter by selected FRMs if not all selected
      if (selectedFRMs.length > 0 && selectedFRMs.length < frms.length) {
        query = query.in('frm_id', selectedFRMs)
      }

      const { data, error } = await query

      if (error) throw error

      // Count visits per day
      const counts = {}
      if (data) {
        data.forEach(visit => {
          const date = visit.visit_date
          counts[date] = (counts[date] || 0) + 1
        })
      }

      setVisitCounts(counts)
    } catch (err) {
      console.error('Error fetching visit counts:', err)
    } finally {
      setLoading(false)
    }
  }

  function goToPreviousMonth() {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  function goToNextMonth() {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  function goToToday() {
    setCurrentMonth(new Date())
  }

  function toggleFRM(frmId) {
    if (selectedFRMs.includes(frmId)) {
      setSelectedFRMs(selectedFRMs.filter(id => id !== frmId))
    } else {
      setSelectedFRMs([...selectedFRMs, frmId])
    }
  }

  function selectAllFRMs() {
    setSelectedFRMs(frms.map(f => f.id))
  }

  function deselectAllFRMs() {
    setSelectedFRMs([])
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const maxCount = Math.max(...Object.values(visitCounts), 1)

  function getHeatColor(count) {
    if (!count) return 'bg-gray-100 hover:bg-gray-200'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity > 0.75) return 'bg-green-600 hover:bg-green-700'
    if (intensity > 0.5) return 'bg-green-500 hover:bg-green-600'
    if (intensity > 0.25) return 'bg-green-400 hover:bg-green-500'
    return 'bg-green-300 hover:bg-green-400'
  }

  return (
    <AppShell fullWidth>
      <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#9D2235' }}>
              Visit Heatmap
            </h1>
            <p className="text-gray-600 text-sm">
              Visual calendar showing daily visit activity
            </p>
          </div>

          {/* FRM Filter */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Filter by FRM</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFRMs}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAllFRMs}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {frms.map(frm => (
                <button
                  key={frm.id}
                  onClick={() => toggleFRM(frm.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    selectedFRMs.includes(frm.id)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {frm.name}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-lg shadow p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={goToPreviousMonth}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                >
                  Today
                </button>
              </div>
              <button
                onClick={goToNextMonth}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Next →
              </button>
            </div>

            {loading ? (
              <Loading />
            ) : (
              <>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-gray-600 p-2">
                      {day}
                    </div>
                  ))}

                  {/* Empty cells for alignment */}
                  {Array(days[0].getDay()).fill(null).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Date cells */}
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const count = visitCounts[dateStr] || 0
                    const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr

                    return (
                      <div
                        key={dateStr}
                        className={`aspect-square p-2 rounded-lg ${getHeatColor(count)} flex flex-col items-center justify-center cursor-pointer transition group relative ${
                          isToday ? 'ring-2 ring-blue-500' : ''
                        }`}
                        title={`${count} visit${count !== 1 ? 's' : ''} on ${format(day, 'MMM d, yyyy')}`}
                      >
                        <span className={`text-sm font-medium ${count > 0 ? 'text-white' : 'text-gray-600'}`}>
                          {format(day, 'd')}
                        </span>
                        {count > 0 && (
                          <span className="text-xs font-bold text-white">{count}</span>
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                            {count} visit{count !== 1 ? 's' : ''}
                            <div className="text-gray-400">{format(day, 'MMM d, yyyy')}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span>Less</span>
                  <div className="flex gap-1">
                    <div className="w-6 h-6 bg-gray-100 rounded border border-gray-300" />
                    <div className="w-6 h-6 bg-green-300 rounded" />
                    <div className="w-6 h-6 bg-green-400 rounded" />
                    <div className="w-6 h-6 bg-green-500 rounded" />
                    <div className="w-6 h-6 bg-green-600 rounded" />
                  </div>
                  <span>More</span>
                </div>

                {/* Summary stats */}
                <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {Object.values(visitCounts).reduce((sum, count) => sum + count, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total Visits</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {Object.keys(visitCounts).length}
                    </div>
                    <div className="text-sm text-gray-600">Active Days</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {Object.keys(visitCounts).length > 0
                        ? Math.round(Object.values(visitCounts).reduce((sum, count) => sum + count, 0) / Object.keys(visitCounts).length)
                        : 0}
                    </div>
                    <div className="text-sm text-gray-600">Avg per Active Day</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
    </AppShell>
  )
}
