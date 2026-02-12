/**
 * Fetch only zones from the latest optimization version.
 * Prevents duplicate zones from showing up when optimization has been run multiple times.
 */
export async function fetchActiveZones(supabase, { select = '*', order = 'zone_number' } = {}) {
  // Get the latest optimization version
  const { data: latestHistory } = await supabase
    .from('optimization_history')
    .select('optimization_version')
    .order('optimization_version', { ascending: false })
    .limit(1)
    .single()

  if (!latestHistory) {
    // No optimization has been run yet - return all zones as fallback
    const { data, error } = await supabase
      .from('route_zones')
      .select(select)
      .order(order)

    return { data: data || [], error }
  }

  // Fetch only zones from the latest version that are active
  const { data, error } = await supabase
    .from('route_zones')
    .select(select)
    .eq('optimization_version', latestHistory.optimization_version)
    .eq('is_active', true)
    .order(order)

  return { data: data || [], error }
}
