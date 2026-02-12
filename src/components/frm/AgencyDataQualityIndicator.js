'use client'

import { getAgencyQualityStatus } from '@/lib/frm/dataQuality'
import MissingDataBadge from './MissingDataBadge'

export default function AgencyDataQualityIndicator({
  agency,
  contacts = [],
  showDetails = false,
  compact = false
}) {
  const quality = getAgencyQualityStatus(agency, contacts)

  if (quality.agencyComplete && quality.contactStats.incomplete === 0) {
    return compact ? (
      <span className="text-green-600 text-sm">✓</span>
    ) : (
      <div className="text-green-600 text-sm font-medium">✓ Complete</div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {!quality.agencyComplete && (
          <MissingDataBadge type="agency" missing={quality.agencyMissing} size="sm" />
        )}
        {quality.contactStats.incomplete > 0 && (
          <span className="text-xs text-yellow-600">{quality.contactStats.incomplete}C</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!quality.agencyComplete && (
        <div className="flex items-center gap-2">
          <MissingDataBadge type="agency" missing={quality.agencyMissing} size="sm" />
          <span className="text-sm text-gray-600">Agency incomplete</span>
        </div>
      )}

      {quality.contactStats.incomplete > 0 && (
        <div className="flex items-center gap-2">
          <MissingDataBadge
            type="contact"
            missing={['contact info']}
            size="sm"
          />
          <span className="text-sm text-gray-600">
            {quality.contactStats.incomplete}/{quality.contactStats.total} contacts incomplete
          </span>
        </div>
      )}

      {showDetails && quality.incompleteContacts.length > 0 && (
        <div className="pl-4 border-l-2 border-yellow-200 mt-2">
          <div className="text-xs font-medium text-gray-700 mb-1">Incomplete Contacts:</div>
          {quality.incompleteContacts.map(contact => (
            <div key={contact.id} className="text-xs text-gray-600">
              • {contact.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
