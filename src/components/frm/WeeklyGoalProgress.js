'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/frm-client'

export default function WeeklyGoalProgress({ frmId }) {
  const [goalData, setGoalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (frmId) {
      fetchWeeklyGoal()
    }
  }, [frmId])

  async function fetchWeeklyGoal() {
    try {
      // Get Monday of current week
      const today = new Date()
      const dayOfWeek = today.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Adjust when day is Sunday
      const monday = new Date(today)
      monday.setDate(today.getDate() + diff)
      const weekStartStr = monday.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('frm_weekly_goals')
        .select('*')
        .eq('frm_id', frmId)
        .eq('week_start_date', weekStartStr)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error
      }

      const goalResult = data || {
        target_visits: 85,
        actual_visits: 0,
        goal_met: false
      }

      console.log('Weekly goal data:', goalResult)
      setGoalData(goalResult)
    } catch (err) {
      console.error('Error fetching weekly goal:', err)
      setGoalData({ target_visits: 85, actual_visits: 0, goal_met: false })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  if (!goalData) return null

  // Ensure values are numbers
  const targetVisits = Number(goalData.target_visits) || 85
  const actualVisits = Number(goalData.actual_visits) || 0

  const progress = targetVisits > 0
    ? (actualVisits / targetVisits) * 100
    : 0

  console.log('Progress calculation:', { actualVisits, targetVisits, progress })

  // Calculate expected progress based on day of week
  // Assuming 17 visits per day, 5 days per week = 85 total
  // Monday = 20%, Tuesday = 40%, Wednesday = 60%, Thursday = 80%, Friday = 100%
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  const workDaysPassed = dayOfWeek === 0 ? 5 : (dayOfWeek === 6 ? 5 : dayOfWeek) // Treat weekend as Friday
  const expectedProgress = (workDaysPassed / 5) * 100

  const isOnTrack = progress >= expectedProgress || progress >= 100
  const isComplete = goalData.goal_met || progress >= 100

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Weekly Goal</h3>
        {isComplete && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Complete
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Progress numbers */}
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-2xl font-bold text-gray-800">
            {actualVisits}
            <span className="text-base text-gray-500 font-normal"> / {targetVisits}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                isComplete ? 'bg-green-500' :
                isOnTrack ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {/* Expected progress marker (only show if not complete) */}
          {!isComplete && expectedProgress < 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
              style={{ left: `${expectedProgress}%` }}
              title={`Expected: ${Math.round(expectedProgress)}%`}
            />
          )}
        </div>

        {/* Status text */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            {Math.round(progress)}% complete
          </span>
          <span className={`font-medium ${
            isComplete ? 'text-green-600' :
            isOnTrack ? 'text-blue-600' : 'text-yellow-600'
          }`}>
            {isComplete ? '🎉 Goal achieved!' :
             isOnTrack ? '✓ On track' : '⚠️ Behind pace'}
          </span>
        </div>

        {/* Additional stats */}
        {!isComplete && (
          <div className="pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Remaining</div>
                <div className="font-semibold text-gray-800">
                  {Math.max(0, targetVisits - actualVisits)} visits
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Expected today</div>
                <div className="font-semibold text-gray-800">
                  {dayOfWeek >= 1 && dayOfWeek <= 5 ? '17 visits' : 'Weekend'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
