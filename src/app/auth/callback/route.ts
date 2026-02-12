import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set(name, value, options)
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set(name, '', options)
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Restrict to @hfexteriors.com domain
      const email = user.email || ''
      if (!email.endsWith('@hfexteriors.com')) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }

      // Upsert user profile on login
      await supabase.from('user_profiles').upsert(
        {
          id: user.id,
          email: user.email!,
          display_name: user.user_metadata?.full_name || user.email!.split('@')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      return NextResponse.redirect(origin)
    }

    console.error('Auth exchange error:', error)
  }

  return NextResponse.redirect(`${origin}/login`)
}
