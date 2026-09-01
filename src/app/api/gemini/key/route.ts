import { NextResponse } from 'next/server'

// فقط همان GEMINI_API_KEY موجود — متغیر جدید تعریف نشده
const APP_HOSTS = ['promptsfa.ir', 'www.promptsfa.ir', 'localhost:3000']

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || ''
  const referer = req.headers.get('referer') || ''

  const ok = APP_HOSTS.some((h) => origin.includes(h) || referer.includes(h))
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'No key' }, { status: 500 })

  return NextResponse.json({ key })
}
