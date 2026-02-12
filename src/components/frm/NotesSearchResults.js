'use client'

import { format } from 'date-fns'
import { parseLocalDate } from '@/lib/frm/dateUtils'
import { HighlightedText } from '@/lib/frm/utils/textHighlight'
import { hapticLight } from '@/lib/frm/utils/haptics'
import Loading from './Loading'

export default function NotesSearchResults({
  results,
  searchTerm,
  loading,
  onEdit,
  onLoadMore,
  hasMore,
  totalCount
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <Loading />
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-400 text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold mb-2 text-gray-900">No results found</h3>
        <p className="text-gray-600">
          {searchTerm ? (
            <>No notes matching "<span className="font-medium">{searchTerm}</span>". Try different keywords or adjust filters.</>
          ) : (
            <>Type at least 2 characters to search conversation notes.</>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Results Header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b">
        <h3 className="font-bold text-lg">
          Results ({results.length}
          {totalCount > results.length && ` of ${totalCount}`})
        </h3>
        {searchTerm && (
          <div className="text-sm text-gray-600">
            Searching for: "<span className="font-medium">{searchTerm}</span>"
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {results.map(visit => (
          <VisitNoteCard
            key={visit.id}
            visit={visit}
            searchTerm={searchTerm}
            onEdit={() => {
              hapticLight()
              onEdit(visit)
            }}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Agency
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                FRM
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map(visit => (
              <VisitNoteRow
                key={visit.id}
                visit={visit}
                searchTerm={searchTerm}
                onEdit={() => {
                  hapticLight()
                  onEdit(visit)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-4 pt-4 border-t text-center">
          <button
            onClick={() => {
              hapticLight()
              onLoadMore()
            }}
            className="px-6 py-2 text-white rounded-lg font-medium transition-colors"
            style={{ backgroundColor: '#9D2235' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7a1a2a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#9D2235'
            }}
          >
            Load More ({Math.min(100, totalCount - results.length)})
          </button>
        </div>
      )}
    </div>
  )
}

// Mobile Card Component
function VisitNoteCard({ visit, searchTerm, onEdit }) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{visit.agencies?.name || 'Unknown Agency'}</div>
          <div className="text-xs text-gray-600">
            {visit.agencies?.city && visit.agencies?.state
              ? `${visit.agencies.city}, ${visit.agencies.state}`
              : 'Location unavailable'}
          </div>
        </div>
        <div className="text-sm text-gray-500 ml-2">
          {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
        </div>
      </div>

      <div className="text-xs text-gray-600 mb-3">
        {visit.frms?.name || 'Unknown FRM'}
      </div>

      <div className="text-sm bg-gray-50 p-3 rounded mb-3">
        {visit.conversation_notes ? (
          <HighlightedText
            text={visit.conversation_notes}
            searchTerm={searchTerm}
          />
        ) : (
          <span className="text-gray-400 italic">No notes</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="px-3 py-1 text-sm text-white rounded transition-colors"
          style={{ backgroundColor: '#5B6770' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4a5761'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5B6770'
          }}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// Desktop Table Row Component
function VisitNoteRow({ visit, searchTerm, onEdit }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
        {format(parseLocalDate(visit.visit_date), 'MMM d, yyyy')}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="font-medium text-gray-900">{visit.agencies?.name || 'Unknown Agency'}</div>
        <div className="text-xs text-gray-500">
          {visit.agencies?.city && visit.agencies?.state
            ? `${visit.agencies.city}, ${visit.agencies.state}`
            : 'Location unavailable'}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {visit.frms?.name || 'Unknown FRM'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
        {visit.conversation_notes ? (
          <HighlightedText
            text={visit.conversation_notes}
            searchTerm={searchTerm}
          />
        ) : (
          <span className="text-gray-400 italic">No notes</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
        <button
          onClick={onEdit}
          className="px-3 py-1 text-sm text-white rounded transition-colors"
          style={{ backgroundColor: '#5B6770' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4a5761'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5B6770'
          }}
        >
          Edit
        </button>
      </td>
    </tr>
  )
}
