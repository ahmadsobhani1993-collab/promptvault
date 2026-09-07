import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const lp = url.searchParams.get('locale')
  if (lp === 'en' || lp === 'fa') {
    url.searchParams.delete('locale')
    const res = NextResponse.redirect(url)
    res.cookies.set('locale', lp, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|rss.xml|manifest.webmanifest|.*\\.(?:png|jpe?g|svg|webp|gif|ico|txt|css|js|woff2?)$).*)'],
}
