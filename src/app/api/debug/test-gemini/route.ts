export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'
import { analyzeWithGemini, generateText, normalizePrompt } from '@/lib/gemini'

export const maxDuration = 120

type Step = {
  step: string
  ok: boolean
  ms: number
  detail?: any
  error?: string
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const key = new URL(req.url).searchParams.get('token')
  if (auth !== 'Bearer pv-cron-8x2m1q' && key !== 'pv-cron-8x2m1q') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const steps: Step[] = []
  const run = async (name: string, fn: () => Promise<any>) => {
    const t = Date.now()
    try {
      const detail = await fn()
      steps.push({ step: name, ok: true, ms: Date.now() - t, detail })
      console.log(`[DIAG] ✓ ${name} (${Date.now() - t}ms)`)
      return { ok: true as const, detail }
    } catch (e: any) {
      steps.push({ step: name, ok: false, ms: Date.now() - t, error: String(e?.message || e) })
      console.log(`[DIAG] ✗ ${name}: ${String(e?.message || e)}`)
      return { ok: false as const, error: e }
    }
  }

  // ── ۱) بررسی env و کلیدها ─────────────────────────────
  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  const keys = rawKeys.split(',').map((s) => s.trim()).filter(Boolean)
  steps.push({
    step: 'env_keys',
    ok: keys.length > 0,
    ms: 0,
    detail: {
      source: process.env.GEMINI_API_KEYS ? 'GEMINI_API_KEYS' : process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'NONE',
      count: keys.length,
      previews: keys.map((k) => k.slice(0, 6) + '...' + k.slice(-4)),
    },
  })

  // ── ۲) فراخوانی خام API با هر کلید و هر مدل ───────────
  const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash']
  for (let i = 0; i < Math.min(keys.length, 3); i++) {
    for (const model of MODELS) {
      await run(`raw_api key#${i} ${model}`, async () => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[i]}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with: OK' }] }] }),
            signal: AbortSignal.timeout(20000),
          }
        )
        const body = await res.text()
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`)
        const json = JSON.parse(body)
        return {
          status: res.status,
          model: json?.modelVersion || model,
          text: json?.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 80) || '(empty)',
        }
      })
    }
  }

  // ── ) generateText ساده (لایه lib) ────────────────────
  await run('generateText_simple', async () => {
    const r = await generateText({ instruction: 'Reply with exactly: PONG' })
    return { model: r.model, text: r.text.slice(0, 100) }
  })

  // ── ۴) normalizePrompt ────────────────────────────────
  await run('normalizePrompt', async () => {
    const out = await normalizePrompt('یک پرامپت تست https://example.com @channel برای ساخت تصویر جنگل')
    return { length: out.length, preview: out.slice(0, 120) }
  })

  // ── ۵) دسته‌بندی‌ها از DB ──────────────────────────────
  let categories: any[] = []
  const catRes = await run('prisma_categories', async () => {
    categories = await prisma.category.findMany({ include: { subs: true } })
    return { count: categories.length, slugs: categories.map((c) => c.slug) }
  })

  // ── ۶) analyzeWithGemini با متن کوچک ───────────────────
  if (catRes.ok) {
    await run('analyze_small_text', async () => {
      const r = await analyzeWithGemini({
        mode: 'auto-import',
        text: 'پرامپت ساخت تصویر منظره کوهستانی در غروب با نور طلایی',
        imgBase64: null,
        categories,
      })
      return { titleFa: r?.titleFa, categorySlug: r?.categorySlug }
    })
  }

  // ── ۷) آیتم واقعی صف (بدون تغییر DB) ───────────────────
  const item = await prisma.telegramQueue
    .findFirst({ where: { status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { id: 'asc' } })
    .catch(() => null)

  if (item && catRes.ok) {
    await run(`analyze_real_item msgId=${item.id}`, async () => {
      const cleaned = await normalizePrompt(item.text ?? '')
      const r = await analyzeWithGemini({
        mode: 'auto-import',
        text: cleaned.slice(0, 3000),
        imgBase64: null,
        categories,
      })
      return {
        inputLen: cleaned.length,
        titleFa: r?.titleFa,
        categorySlug: r?.categorySlug,
      }
    })
  } else {
    steps.push({ step: 'analyze_real_item', ok: true, ms: 0, detail: 'no pending item in queue' })
  }

  const failed = steps.filter((s) => !s.ok)
  return NextResponse.json({
    ok: failed.length === 0,
    first_failure: failed[0]?.step || null,
    steps,
  })
}

