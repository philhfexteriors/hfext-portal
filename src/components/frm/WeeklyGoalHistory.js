'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/frm-client'

export default function WeeklyGoalHistory({ frmId }) {
  const [weeklyData, setWeeklyData] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (frmId) {
      fetchWeeklyHistory()
    }
  }, [frmId])

  async function fetchWeeklyHistory() {
    try {
      // Get last 4 weeks of data (current + previous 3)
      const weeks = []
      const today = new Date()

      for (let i = 0; i < 4; i++) {
        const weekDate = new Date(today)
        weekDate.setDate(today.getDate() - (i * 7))

        // Get Monday of that week
        const dayOfWeek = weekDate.getDay()
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(weekDate)
        monday.setDate(weekDate.getDate() + diff)

        weeks.push({
          weekStart: monday.toISOString().split('T')[0],
          monday: new Date(monday)
        })
      }

      // Fetch data for all weeks
      const { data, error } = await supabase
        .from('frm_weekly_goals')
        .select('*')
        .eq('frm_id', frmId)
        .in('week_start_date', weeks.map(w => w.weekStart))

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // Combine with week data
      const weeklyResults = weeks.map(week => {
        const goalData = data?.find(d => d.week_start_date === week.weekStart)
        return {
          weekStart: week.weekStart,
          monday: week.monday,
          target_visits: goalData?.target_visits || 85,
          actual_visits: goalData?.actual_visits || 0,
          goal_met: goalData?.goal_met || false
        }
      })

      setWeeklyData(weeklyResults)
    } catch (err) {
      console.error('Error fetching weekly history:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function formatWeekRange(monday) {
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    if (monday.getMonth() === friday.getMonth()) {
      return `${monthNames[monday.getMonth()]} ${monday.getDate()}-${friday.getDate()}`
    } else {
      return `${monthNames[monday.getMonth()]} ${monday.getDate()} - ${monthNames[friday.getMonth()]} ${friday.getDate()}`
    }
  }

  function isCurrentWeek(weekStart) {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const thisMonday = new Date(today)
    thisMonday.setDate(today.getDate() + diff)
    const thisMondayStr = thisMonday.toISOString().split('T')[0]
    return weekStart === thisMondayStr
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Weekly Goal History
      </h3>

      <div className="space-y-3">
        {weeklyData.map((week, idx) => {
          const progress = week.target_visits > 0
            ? (week.actual_visits / week.target_visits) * 100
            : 0

          const isCurrent = isCurrentWeek(week.weekStart)
          const isComplete = week.goal_met || progress >= 100

          return (
            <div
              key={week.weekStart}
              className={`border rounded-lg p-4 ${isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {formatWeekRange(week.monday)}
                  </span>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
                      Current
                    </span>
                  )}
                  {isComplete && !isCurrent && (
                    <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                      ✓ Complete
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {week.actual_visits} / {week.target_visits}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    isComplete ? 'bg-green-500' :
                    progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <div className="mt-1 text-xs text-gray-600 text-right">
                {Math.round(progress)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
