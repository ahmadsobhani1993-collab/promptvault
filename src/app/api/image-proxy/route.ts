import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url || !url.includes('api.telegram.org')) {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://web.telegram.org/',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return new NextResponse('Failed to fetch', { status: response.status })
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse('Proxy error', { status: 500 })
  }
}
