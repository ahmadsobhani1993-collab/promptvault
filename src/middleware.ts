import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // قاعده طلایی: آدرس تعیین‌کننده مطلق زبان است
  const isEn = pathname === "/en" || pathname.startsWith("/en/")
  const locale = isEn ? "en" : "fa"

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-locale", locale)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  return response
}

export const config = {
  matcher: ["/((?!api|_next|static|.*\..*).*)"],
}
