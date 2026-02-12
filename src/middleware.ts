import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Map URL path prefixes to app slugs for access control
const APP_PATH_MAP: Record<string, string> = {
  '/marketing/sm': 'sm',
  '/marketing/frm': 'frm',
  '/sales/plans': 'plans',
  '/production/windows': 'windows',
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes — no auth needed
  if (pathname === '/login' || pathname.startsWith('/auth/')) {
    return response
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Check app-level access for protected app routes
  for (const [pathPrefix, appSlug] of Object.entries(APP_PATH_MAP)) {
    if (pathname.startsWith(pathPrefix)) {
      const { data: hasAccess } = await supabase.rpc('user_has_app_access', {
        user_uuid: user.id,
        check_app_slug: appSlug,
      })

      if (!hasAccess) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('error', 'no_access')
        return NextResponse.redirect(url)
      }
      break
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
