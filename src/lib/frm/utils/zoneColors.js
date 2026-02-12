/**
 * Zone color palette for map visualization
 * 12 distinct colors optimized for visibility on map backgrounds
 */

export const ZONE_COLORS = [
  '#E63946',  // Red
  '#457B9D',  // Steel Blue
  '#2A9D8F',  // Teal
  '#E9C46A',  // Sand/Yellow
  '#F4A261',  // Orange
  '#264653',  // Dark Teal
  '#6A4C93',  // Purple
  '#1982C4',  // Blue
  '#8AC926',  // Yellow Green
  '#FF595E',  // Coral
  '#6D6875',  // Gray Purple
  '#B5838D',  // Mauve
]

export function getZoneColor(zoneIndex) {
  return ZONE_COLORS[zoneIndex % ZONE_COLORS.length]
}
