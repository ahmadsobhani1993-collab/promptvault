import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

const GITHUB_REPO = 'ai-boost/awesome-prompts'
const GITHUB_PATH = 'prompts'
const DEFAULT_CODE_IMG = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80&auto=format&fit=crop'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

async function listFiles(): Promise<{ name: string; path: string; sha: string }[]> {
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'promptsfa-importer',
        ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}),
      },
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!r.ok) throw new Error('github list failed: ' + r.status)
  const data = await r.json()
  if (!Array.isArray(data)) return []
  return data.filter((f: any) => f.type === 'file' && /\.(md|txt|prompt)$/i.test(f.name))
}

async function getFileContent(path: string): Promise<string> {
  const r = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'promptsfa-importer',
        ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}),
      },
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!r.ok) throw new Error('github get failed: ' + r.status)
  return r.text()
}

function fileSlug(name: string): string {
  return name
    .replace(/\.(md|txt|prompt)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const count = Math.min(5, parseInt(q.get('count') || '3', 10))

  const files = await listFiles()
  const lastSha = await getSetting('github_last_sha', '')
  const startIdx = lastSha ? files.findIndex((f) => f.sha === lastSha) + 1 : 0

  if (startIdx >= files.length) {
    return NextResponse.json({ ok: true, imported: 0, reason: 'all files processed', total: files.length })
  }

  const categories = await prisma.category.findMany({ include: { subs: true } })
  const results: any[] = []
  let imported = 0

  for (let i = startIdx; i < files.length && imported < count; i++) {
    const file = files[i]
    const slug = 'gh-' + fileSlug(file.name)
    const start = Date.now()

    try {
      if (await prisma.prompt.findUnique({ where: { slug } })) {
        results.push({ file: file.name, skip: 'exists' })
        await setSetting('github_last_sha', file.sha)
        continue
      }

      const content = await getFileContent(file.path)
      if (content.length < 50) {
        results.push({ file: file.name, skip: 'too short' })
        await setSetting('github_last_sha', file.sha)
        continue
      }

      const ai = await analyzeWithGemini({ text: content, imgBase64: null, categories })
      const cat = categories.find((c) => c.slug === ai.categorySlug) ?? categories[0]
      const sub = ai.subSlug ? cat.subs.find((s) => s.slug === ai.subSlug) ?? null : null

      await prisma.prompt.create({
        data: {
          slug,
          titleFa: ai.titleFa,
          titleEn: ai.titleEn,
          descFa: ai.descFa,
          descEn: ai.descEn,
          usageFa: ai.usageFa,
          usageEn: ai.usageEn,
          img: DEFAULT_CODE_IMG,
          model: 'System Prompt',
          type: 'CODE',
          status: 'PENDING',
          categoryId: cat.id,
          subId: sub?.id ?? null,
          tagsFa: ai.tagsFa,
          tagsEn: ai.tagsEn,
          prompt: content.trim(),
          views: Math.floor(Math.random() * 50),
        },
      })

      imported++
      results.push({ file: file.name, slug, cat: cat.slug, ms: Date.now() - start })
      await setSetting('github_last_sha', file.sha)
    } catch (e: any) {
      results.push({ file: file.name, error: String(e?.message || e), ms: Date.now() - start })
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    totalFiles: files.length,
    remaining: files.length - (startIdx + imported),
    results,
  })
}
