import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale = isEn ? 'en' : 'fa'

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-locale', locale)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  if (req.cookies.get('locale')?.value !== locale) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  // Login hint flag for the client (session cookie itself is httpOnly)
  const hasSession = req.cookies.getAll().some((c) => c.name.includes('session-token'))
  const hasFlag = req.cookies.get('pf_li')?.value === '1'
  if (hasSession && !hasFlag) {
    response.cookies.set('pf_li', '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  } else if (!hasSession && req.cookies.has('pf_li')) {
    response.cookies.delete('pf_li')
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|static|.*\\..*).*)'],
}