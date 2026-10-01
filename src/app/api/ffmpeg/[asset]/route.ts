import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ASSETS: Record<string, { packagePath: string; contentType: string }> = {
  'worker.js': { packagePath: '@ffmpeg/ffmpeg/dist/esm/worker.js', contentType: 'text/javascript; charset=utf-8' },
  'const.js': { packagePath: '@ffmpeg/ffmpeg/dist/esm/const.js', contentType: 'text/javascript; charset=utf-8' },
  'errors.js': { packagePath: '@ffmpeg/ffmpeg/dist/esm/errors.js', contentType: 'text/javascript; charset=utf-8' },
  'utils.js': { packagePath: '@ffmpeg/ffmpeg/dist/esm/utils.js', contentType: 'text/javascript; charset=utf-8' },
  'ffmpeg-core.js': { packagePath: '@ffmpeg/core/dist/esm/ffmpeg-core.js', contentType: 'text/javascript; charset=utf-8' },
  'ffmpeg-core.wasm': { packagePath: '@ffmpeg/core/dist/esm/ffmpeg-core.wasm', contentType: 'application/wasm' },
}

export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params
  const file = ASSETS[asset]
  if (!file) return NextResponse.json({ error: 'FFmpeg asset not found' }, { status: 404 })

  try {
    const bytes = await readFile(join(process.cwd(), 'node_modules', file.packagePath))
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': process.env.NODE_ENV === 'production' ? 'public, max-age=31536000, immutable' : 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error(`[FFmpeg Asset Error] ${asset}`, error)
    return NextResponse.json({ error: `FFmpeg asset unavailable: ${asset}` }, { status: 500 })
  }
}