import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url || !url.includes('api.telegram.org')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const response = await fetch(url)
    const contentType = response.headers.get('content-type')
    const buffer = await response.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
