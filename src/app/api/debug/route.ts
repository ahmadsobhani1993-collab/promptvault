import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let geminiTest: string
  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        (process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite') +
        ':generateContent?key=' +
        process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }] }),
        signal: AbortSignal.timeout(15000),
      }
    )
    const b = await r.text()
    geminiTest = r.ok ? 'OK: ' + (b.match(/"text":\s*"([^"]+)"/)?.[1] ?? 'answered') : 'HTTP ' + r.status + ' :: ' + b.slice(0, 250)
  } catch (e: any) {
    geminiTest = 'ERROR: ' + String(e?.message ?? e)
  }

  return NextResponse.json({
    envs: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set (' + process.env.GEMINI_API_KEY!.length + ' chars)' : 'MISSING',
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'default(gemini-2.0-flash-lite)',
      TELEGRAM_CHANNEL: process.env.TELEGRAM_CHANNEL || 'MISSING',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'MISSING',
      TELEGRAM_OUTPUT: process.env.TELEGRAM_OUTPUT || 'MISSING',
    },
    geminiTest,
    time: new Date().toISOString(),
  })
}
