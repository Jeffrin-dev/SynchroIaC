import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/', '/api/webhooks/paddle', '/api/v1/ingest']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard')) {
    const hasSupabaseSession = req.cookies
      .getAll()
      .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))

    if (!hasSupabaseSession) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/api/webhooks/paddle', '/api/v1/ingest']
}
