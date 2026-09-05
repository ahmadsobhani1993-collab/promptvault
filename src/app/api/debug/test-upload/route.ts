import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { uploadRemoteDirectly, uploadFromUrl } from '@/lib/cloudinary'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const testUrl = q.get('url') || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400'
  const method = q.get('method') || 'direct'

  const start = Date.now()
  try {
    let result
    if (method === 'direct') {
      result = await uploadRemoteDirectly(testUrl, 'promptsfa/test')
    } else {
      result = await uploadFromUrl(testUrl, 'promptsfa/test')
    }

    return NextResponse.json({
      ok: true,
      method,
      url: result.url,
      publicId: result.publicId,
      ms: Date.now() - start,
      note: method === 'direct'
        ? '✅ Cloudinary مستقیماً از URL دانلود کرد — 0 egress از Vercel'
        : '⚠️ Vercel دانلود کرد و بعد آپلود کرد — 2x egress',
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      method,
      error: String(e?.message || e),
      ms: Date.now() - start,
    })
  }
}
