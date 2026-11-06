export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Gemini credentials are server-side only; use the authenticated Cloudflare gateway.' },
    { status: 410 },
  )
}
