import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// FRM data uses a direct client (not cookie-based auth) since
// auth is handled by the portal Supabase. This is a data-only client.
export async function createClient() {
  return createSupabaseClient(
    process.env.FRM_SUPABASE_URL,
    process.env.FRM_SUPABASE_ANON_KEY
  )
}
