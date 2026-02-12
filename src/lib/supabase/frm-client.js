import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_FRM_SUPABASE_URL,
    process.env.NEXT_PUBLIC_FRM_SUPABASE_ANON_KEY
  )
}
