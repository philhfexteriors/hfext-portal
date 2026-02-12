'use client'

import Link from 'next/link'
import { formatDistance } from '@/lib/frm/utils/distance'
import { format, differenceInHours, differenceInMinutes } from 'date-fns'
import { hapticLight } from '@/lib/frm/utils/haptics'

export default function DaySummary({
  zoneName,
  dayOfWeek,
  totalAgencies,
  totalDistance,
  visits = [],
  onPlanTomorrow,
  onFinishDay
}) {
  // Calculate time spent (first visit to last visit)
  const calculateTimeSpent = () => {
    if (!visits || visits.length === 0) return '--'

    const sortedVisits = [...visits].sort((a, b) =>
      new Date(a.visit_date) - new Date(b.visit_date)
    )

    const firstVisit = new Date(sortedVisits[0].visit_date)
    const lastVisit = new Date(sortedVisits[sortedVisits.length - 1].visit_date)

    const hours = differenceInHours(lastVisit, firstVisit)
    const minutes = differenceInMinutes(lastVisit, firstVisit) % 60

    if (hours === 0 && minutes === 0) {
      return '< 1 min'
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }

    return `${minutes}m`
  }

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const dayName = dayNames[dayOfWeek] || `Day ${dayOfWeek}`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Day Complete!
          </h2>
          <p className="text-gray-600">
            Great work on {zoneName} - {dayName}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {totalAgencies}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Agencies
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {formatDistance(totalDistance).replace(' mi', '')}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Miles
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">
              {calculateTimeSpent()}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Time
            </div>
          </div>
        </div>

        {/* Today's Date */}
        <div className="text-center text-sm text-gray-500">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Plan Tomorrow */}
          {onPlanTomorrow && (
            <button
              onClick={() => {
                hapticLight()
                onPlanTomorrow()
              }}
              className="w-full bg-[#9D2235] text-white py-3 px-4 rounded-lg hover:bg-[#8A1E2E] transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Plan Tomorrow
            </button>
          )}

          {/* View All Visits */}
          <Link
            href={`/?date=${new Date().toISOString().split('T')[0]}`}
            onClick={() => hapticLight()}
            className="block w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
          >
            View All Visits
          </Link>

          {/* Finish Day */}
          {onFinishDay && (
            <button
              onClick={() => {
                hapticLight()
                onFinishDay()
              }}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Finish Day
            </button>
          )}
        </div>

        {/* Fun Encouragement */}
        <div className="text-center text-sm text-gray-500 italic">
          {totalAgencies >= 17 && totalDistance >= 20 && '🌟 Outstanding effort!'}
          {totalAgencies >= 15 && totalAgencies < 17 && '💪 Great work!'}
          {totalAgencies < 15 && '👍 Nice job!'}
        </div>
      </div>
    </div>
  )
}
