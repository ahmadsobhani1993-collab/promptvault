export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const BATCH = 20
const MAX_TEXT = 4096
const NUMERIC_ID = /^\d{5,15}$/

type SendResult = { status: 'sent' | 'unreachable' | 'failed'; error?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') return null
  return session
}

async function sendOne(chatId: string, text: string, preview: boolean, retried = false): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { status: 'failed', error: 'no bot token' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: !preview,
      }),
    })
    const data: any = await res.json().catch(() => null)

    if (data?.ok) return { status: 'sent' }

    // Rate limit: wait once and retry
    if (res.status === 429 && !retried) {
      const wait = Math.min(Number(data?.parameters?.retry_after) || 3, 8)
      await sleep(wait * 1000)
      return sendOne(chatId, text, preview, true)
    }

    // 403 = user blocked the bot, 400 = chat not found (never started the bot)
    if (res.status === 403 || res.status === 400) {
      return { status: 'unreachable', error: data?.description }
    }
    return { status: 'failed', error: data?.description }
  } catch {
    return { status: 'failed', error: 'network' }
  }
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const rows = await prisma.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "User" WHERE "telegram" ~ '^[0-9]+$'
  `
  return NextResponse.json({
    recipients: rows?.[0]?.c ?? 0,
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'متغیر TELEGRAM_BOT_TOKEN تنظیم نشده است.' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 })
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const preview = !!body?.preview
  const mode = body?.mode

  if (!text) return NextResponse.json({ ok: false, error: 'متن پیام خالی است.' }, { status: 400 })
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ ok: false, error: `متن بیشتر از ${MAX_TEXT} کاراکتر است.` }, { status: 400 })
  }

  // --- Test: send to the admin's own linked Telegram ---
  if (mode === 'test') {
    const me = await prisma.user.findUnique({
      where: { id: admin.user!.id },
      select: { telegram: true },
    })
    if (!me?.telegram || !NUMERIC_ID.test(me.telegram)) {
      return NextResponse.json(
        { ok: false, error: 'حساب تو به تلگرام متصل نیست (شناسهٔ عددی تلگرام ثبت نشده).' },
        { status: 400 }
      )
    }
    const r = await sendOne(me.telegram, text, preview)
    return NextResponse.json({ ok: r.status === 'sent', result: r.status, error: r.error })
  }

  // --- Single: one numeric Telegram ID ---
  if (mode === 'single') {
    const target = typeof body?.target === 'string' ? body.target.trim() : ''
    if (!NUMERIC_ID.test(target)) {
      return NextResponse.json({ ok: false, error: 'شناسهٔ عددی تلگرام نامعتبر است.' }, { status: 400 })
    }
    const r = await sendOne(target, text, preview)
    return NextResponse.json({ ok: r.status === 'sent', result: r.status, error: r.error })
  }

  // --- Broadcast: one batch per request, cursor-based ---
  if (mode === 'broadcast') {
    const cursor = typeof body?.cursor === 'string' && body.cursor ? body.cursor : null

    const rows = await prisma.user.findMany({
      where: {
        telegram: { not: null },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: { id: true, telegram: true },
    })

    const targets = rows.filter((u) => u.telegram && NUMERIC_ID.test(u.telegram))
    const results = await Promise.all(targets.map((u) => sendOne(u.telegram as string, text, preview)))

    const sent = results.filter((r) => r.status === 'sent').length
    const unreachable = results.filter((r) => r.status === 'unreachable').length
    const failed = results.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      ok: true,
      scanned: rows.length,
      sent,
      unreachable,
      failed,
      nextCursor: rows.length ? rows[rows.length - 1].id : cursor,
      done: rows.length < BATCH,
    })
  }

  return NextResponse.json({ ok: false, error: 'mode نامعتبر است.' }, { status: 400 })
}