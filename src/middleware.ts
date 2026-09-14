import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const { pathname } = url

  // رد کردن فایل‌های سیستمی و مدیا
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // بررسی وضعیت انگلیسی بودن
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale = isEn ? 'en' : 'fa'

  // اگر کاربر روی /en بود، مسیر داخلی را به مسیر واقعی نگاشت کن
  if (isEn) {
    const internalPath = pathname.replace(/^\/en/, '') || '/'
    url.pathname = internalPath

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-locale', 'en')

    const res = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    })
    res.cookies.set('locale', 'en', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  }

  // مسیرهای پیش‌فرض فارسی
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-locale', 'fa')

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  res.cookies.set('locale', 'fa', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return res
}

export const config = {
  matcher: ['/((?!api|_next|static|.*\\..*).*)'],
}
