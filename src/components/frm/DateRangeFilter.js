'use client'

export default function DateRangeFilter({ dateRange, setDateRange }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">Date Range</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Start Date</label>
          <input
            type="date"
            value={dateRange.start || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">End Date</label>
          <input
            type="date"
            value={dateRange.end || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setDateRange({ start: null, end: null })}
            className="w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            Clear Dates
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0]
            setDateRange({ start: today, end: today })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          Today
        </button>
        <button
          onClick={() => {
            const today = new Date()
            const weekAgo = new Date(today)
            weekAgo.setDate(today.getDate() - 7)
            setDateRange({ 
              start: weekAgo.toISOString().split('T')[0], 
              end: today.toISOString().split('T')[0] 
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          Last 7 Days
        </button>
        <button
          onClick={() => {
            const today = new Date()
            const monthAgo = new Date(today)
            monthAgo.setMonth(today.getMonth() - 1)
            setDateRange({ 
              start: monthAgo.toISOString().split('T')[0], 
              end: today.toISOString().split('T')[0] 
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          Last 30 Days
        </button>
        <button
          onClick={() => {
            const today = new Date()
            const yearStart = new Date(today.getFullYear(), 0, 1)
            setDateRange({ 
              start: yearStart.toISOString().split('T')[0], 
              end: today.toISOString().split('T')[0] 
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          Year to Date
        </button>
      </div>
    </div>
  )
}