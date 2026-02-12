'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import EditVisitDrawer from './EditVisitDrawer'

export default function RecentVisits({ visits, onDelete, onEdit }) {
  const router = useRouter()
  const [editingVisit, setEditingVisit] = useState(null)
  const [showEditDrawer, setShowEditDrawer] = useState(false)

  const recentVisits = useMemo(() => {
    // Return only 5 most recent visits
    return visits.slice(0, 5)
  }, [visits])

  function handleEdit(visit) {
    setEditingVisit(visit)
    setShowEditDrawer(true)
  }

  function closeEditDrawer() {
    setShowEditDrawer(false)
    setEditingVisit(null)
  }

  async function handleSaveEdit(updatedVisit) {
    await onEdit(updatedVisit)
    closeEditDrawer()
  }

  async function handleDelete(visitId) {
    if (confirm('Are you sure you want to delete this visit?')) {
      await onDelete(visitId)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-bold text-lg mb-4">Recent Visits (Last 5)</h2>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {recentVisits.map(visit => (
            <div key={visit.id} className="border rounded-lg p-3 space-y-2">
              <div className="font-semibold">{visit.agencies?.name}</div>
              <div className="text-sm text-gray-600">
                {format(new Date(visit.visit_date), 'MMM d, yyyy')}
              </div>
              {visit.conversation_notes && (
                <div className="text-sm text-gray-700 line-clamp-2">
                  {visit.conversation_notes}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(visit)}
                  className="text-sm px-3 py-1 text-white rounded-lg font-semibold"
                  style={{ backgroundColor: '#5B6770' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(visit.id)}
                  className="text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Agency</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Notes</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {recentVisits.map(visit => (
                <tr key={visit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm">{visit.agencies?.name}</td>
                  <td className="px-4 py-3 text-sm max-w-md truncate">
                    {visit.conversation_notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(visit)}
                        className="text-sm px-3 py-1 text-white rounded-lg font-semibold hover:shadow-md transition-all"
                        style={{ backgroundColor: '#5B6770' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a5761'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B6770'}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(visit.id)}
                        className="text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold hover:shadow-md transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/marketing/frm/recent-visits')}
            className="px-6 py-2 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
            style={{ backgroundColor: '#9D2235' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8a1e2f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9D2235'}
          >
            Full List
          </button>
        </div>
      </div>

      {showEditDrawer && (
        <EditVisitDrawer
          visit={editingVisit}
          onClose={closeEditDrawer}
          onSave={handleSaveEdit}
        />
      )}
    </>
  )
}
