'use client'

export default function FRMFilters({ 
  frms,
  selectedFRMs, 
  setSelectedFRMs,
  activeFRMsOnly, 
  setActiveFRMsOnly, 
  myVisitsOnly, 
  setMyVisitsOnly 
}) {
  
  function toggleFRM(frmId) {
    setSelectedFRMs(prev => 
      prev.includes(frmId)
        ? prev.filter(id => id !== frmId)
        : [...prev, frmId]
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-bold text-lg mb-4">FRM Selections</h2>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={activeFRMsOnly}
            onChange={(e) => setActiveFRMsOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm">Active FRMs Only</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={myVisitsOnly}
            onChange={(e) => setMyVisitsOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm">My Visits Only</span>
        </label>
      </div>

      {frms.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Select FRMs to filter:</p>
          <div className="flex flex-wrap gap-2">
            {frms.map(frm => (
              <button
                key={frm.id}
                onClick={() => toggleFRM(frm.id)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedFRMs.includes(frm.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {frm.name}
              </button>
            ))}
          </div>
          {selectedFRMs.length > 0 && (
            <button
              onClick={() => setSelectedFRMs([])}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  )
}