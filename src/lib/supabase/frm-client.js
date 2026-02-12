import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let cachedClient = null

export function createClient() {
  if (cachedClient) return cachedClient

  cachedClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_FRM_SUPABASE_URL,
    process.env.NEXT_PUBLIC_FRM_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )

  return cachedClient
}
