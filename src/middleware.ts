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

  // ISR pages: anonymous visitors and bots must never get a Set-Cookie,
  // otherwise the CDN may refuse to cache the response.
  const isCacheablePage = /^\/(en\/)?prompts\//.test(pathname)

  if (!isCacheablePage && req.cookies.get('locale')?.value !== locale) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  // Login hint flag for the client (the session cookie itself is httpOnly).
  // Only logged-in users ever receive it on cacheable pages.
  const hasSession = req.cookies.getAll().some((c) => c.name.includes('session-token'))
  const hasFlag = req.cookies.get('pf_li')?.value === '1'
  if (hasSession && !hasFlag) {
    response.cookies.set('pf_li', '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  } else if (!hasSession && hasFlag && !isCacheablePage) {
    response.cookies.delete('pf_li')
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|static|.*\\..*).*)'],
}