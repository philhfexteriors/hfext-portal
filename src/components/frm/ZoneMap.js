'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import { computeConvexHull } from '@/lib/frm/utils/convexHull'
import { getGoogleMapsDirectionsUrl } from '@/lib/frm/utils/maps'

function createZoneIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8]
  })
}

function createSequenceIcon(color, sequenceNumber) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 24px; height: 24px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      color: white;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    ">${sequenceNumber}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  })
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [map, JSON.stringify(bounds)])
  return null
}

export default function ZoneMap({ zones, agenciesByZone, visibleZones, selectedDay, zoneColors, onAgencyClick }) {
  // Compute all visible agencies
  const visibleAgencies = useMemo(() => {
    const agencies = []
    for (const zoneId of visibleZones) {
      const zoneData = agenciesByZone[zoneId]
      if (!zoneData) continue

      if (selectedDay) {
        const dayAgencies = zoneData.dayAgencies[selectedDay] || []
        agencies.push(...dayAgencies.map(a => ({ ...a, zoneId })))
      } else {
        agencies.push(...zoneData.agencies.map(a => ({ ...a, zoneId })))
      }
    }
    return agencies
  }, [agenciesByZone, visibleZones, selectedDay])

  // Compute bounds for auto-zoom
  const bounds = useMemo(() => {
    const coords = visibleAgencies
      .filter(a => a.latitude && a.longitude)
      .map(a => [parseFloat(a.latitude), parseFloat(a.longitude)])
    return coords.length > 0 ? coords : null
  }, [visibleAgencies])

  // Compute convex hulls per visible zone
  const zoneHulls = useMemo(() => {
    const hulls = {}
    for (const zoneId of visibleZones) {
      const zoneData = agenciesByZone[zoneId]
      if (!zoneData) continue

      // Use all agencies in the zone for the hull (not just the day's)
      const points = zoneData.agencies
        .filter(a => a.latitude && a.longitude)
        .map(a => [parseFloat(a.latitude), parseFloat(a.longitude)])

      const hull = computeConvexHull(points)
      if (hull.length >= 3) {
        hulls[zoneId] = hull
      }
    }
    return hulls
  }, [agenciesByZone, visibleZones])

  // Default center (roughly center of US) if no agencies
  const defaultCenter = [39.8283, -98.5795]
  const center = bounds && bounds.length > 0
    ? [
        bounds.reduce((s, b) => s + b[0], 0) / bounds.length,
        bounds.reduce((s, b) => s + b[1], 0) / bounds.length
      ]
    : defaultCenter

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {bounds && <FitBounds bounds={bounds} />}

      {/* Zone boundary polygons */}
      {Object.entries(zoneHulls).map(([zoneId, hull]) => (
        <Polygon
          key={`hull-${zoneId}`}
          positions={hull}
          pathOptions={{
            color: zoneColors[zoneId] || '#999',
            fillColor: zoneColors[zoneId] || '#999',
            fillOpacity: 0.12,
            weight: 2,
            opacity: 0.5,
            dashArray: '5, 5'
          }}
        />
      ))}

      {/* Agency markers */}
      {visibleAgencies
        .filter(a => a.latitude && a.longitude)
        .map((agency) => {
          const color = zoneColors[agency.zoneId] || '#999'
          const icon = selectedDay && agency.sequence_order
            ? createSequenceIcon(color, agency.sequence_order)
            : createZoneIcon(color)

          const lat = parseFloat(agency.latitude)
          const lng = parseFloat(agency.longitude)
          const zone = zones.find(z => z.id === agency.zoneId)
          const zoneName = zone?.custom_name || zone?.zone_name || 'Unknown Zone'
          const directionsUrl = getGoogleMapsDirectionsUrl(lat, lng)
          const fullAddress = [agency.address, agency.city, agency.state, agency.zip].filter(Boolean).join(', ')

          return (
            <Marker
              key={`${agency.id}-${agency.zoneId}-${agency.day_of_week || 'all'}`}
              position={[lat, lng]}
              icon={icon}
            >
              <Popup>
                <div style={{ minWidth: 180, fontSize: 13 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#1a1a1a' }}>
                    {agency.name}
                  </div>
                  <div style={{ color: '#666', marginBottom: 6, lineHeight: 1.4 }}>
                    {fullAddress}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: color,
                      flexShrink: 0
                    }}></span>
                    <span style={{ fontSize: 12, color: '#555' }}>{zoneName}</span>
                  </div>
                  {selectedDay && agency.sequence_order && (
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
                      Stop #{agency.sequence_order}
                    </div>
                  )}
                  {agency.phone && (
                    <div style={{ marginBottom: 6 }}>
                      <a href={`tel:${agency.phone}`} style={{ color: '#1982C4', textDecoration: 'none', fontSize: 12 }}>
                        {agency.phone}
                      </a>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        background: '#9D2235',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        textDecoration: 'none',
                        fontWeight: 500
                      }}
                    >
                      Directions
                    </a>
                    {onAgencyClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAgencyClick(agency, agency.zoneId)
                        }}
                        style={{
                          display: 'inline-block',
                          background: '#457B9D',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
    </MapContainer>
  )
}
