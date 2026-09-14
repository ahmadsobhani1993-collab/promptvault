import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // استثنا کردن فایل‌های استاتیک، تصاویر و APIها
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // فایل‌ها مثل favicon, تصاویر و ...
  ) {
    return NextResponse.next()
  }

  const isEn = pathname.startsWith('/en')
  const locale = isEn ? 'en' : 'fa'

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-locale', locale)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // ذخیره کوکی هماهنگ با مسیر
  response.cookies.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
