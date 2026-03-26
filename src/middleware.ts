import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true'

const PROTECTED_ROUTES = [
  '/dashboard',
  '/products',
  '/categories',
  '/analytics',
  '/returns',
  '/settings',
  '/import',
  '/migrate',
]

export async function middleware(request: NextRequest) {
  if (!USE_SUPABASE) {
    return NextResponse.next()
  }

  const response = await updateSession(request)

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtected) {
    const {
      data: { user },
    } = await (await import('@/lib/supabase/server')).createClient().then((sb) =>
      sb.auth.getUser()
    )

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
