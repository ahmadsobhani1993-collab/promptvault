import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // فایل‌های استاتیک، تصاویر و APIها بدون تغییر رد شوند
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale = isEn ? 'en' : 'fa'

  // اگر مسیر انگلیسی بود، پیشوند /en را در پشت‌صحنه بردار تا به صفحه اصلی متصل شود
  let targetPath = pathname
  if (isEn) {
    targetPath = pathname.replace(/^\/en/, '') || '/'
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-locale', locale)

  // با Rewrite، آدرس در مرورگر /en باقی می‌ماند ولی همان کدهای قبلی با زبان انگلیسی اجرا می‌شوند
  const url = req.nextUrl.clone()
  url.pathname = targetPath

  const response = NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders,
    },
  })

  // ذخیره کوکی هماهنگ با URL
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
