#!/bin/bash
set -e

mkdir -p src/app/api/process-submit

# ---------- 1) admin dashboard: clean responsive rewrite ----------
cat > src/app/admin/page.tsx << 'EOF'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مدیریت | PromptsFA' }

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const [prompts, users, likes, comments, pending] = await Promise.all([
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.like.count(),
    prisma.comment.count(),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
  ])

  const latest = await prisma.prompt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, titleFa: true, likes: true, status: true, slug: true },
  })

  const nav = [
    { href: '/admin', label: ' داشبورد' },
    { href: '/admin/prompts', label: '📦 پرامپت‌ها' + (pending ? ' (' + pending + ')' : '') },
    { href: '/admin/articles', label: '📚 مقالات' },
    { href: '/admin/categories', label: '🗂 دسته‌بندی‌ها' },
    { href: '/admin/comments', label: '💬 کامنت‌ها' },
    { href: '/admin/users', label: '👥 کاربرها و ادمین‌ها' },
  ]

  const stats = [
    { label: 'پرامپت‌ها', value: prompts },
    { label: 'کاربرها', value: users },
    { label: 'لایک‌ها', value: likes },
    { label: 'کامنت‌ها', value: comments },
  ]

  return (
    <section className="container-app py-10">
      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-col">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="btn-secondary justify-center whitespace-nowrap text-xs">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="btn-secondary justify-center whitespace-nowrap text-xs">← بازگشت به سایت</Link>
        </aside>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xs text-ink-muted">{s.label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="card mt-5 overflow-hidden">
            <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">آخرین پرامپت‌ها</p>
            <div className="divide-y divide-line">
              {latest.map((p) => (
                <Link key={p.id} href={'/prompts/' + p.slug} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated">
                  <span className="min-w-0 truncate text-xs text-ink">{p.titleFa}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (p.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : p.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400')}>
                      {p.status === 'PUBLISHED' ? 'منتشر' : p.status === 'PENDING' ? 'در انتظار' : 'رد'}
                    </span>
                    <span className="text-[10px] text-ink-faint">❤ {p.likes}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
EOF

# ---------- 2) new caption format everywhere ----------
node << 'NODEEOF'
const fs = require('fs')

for (const p of ['src/app/api/cron/telegram/route.ts', 'src/app/api/cron/broadcast/route.ts']) {
  let s = fs.readFileSync(p, 'utf8')
  s = s.replace("const TG_FOOTER = '\\n\\n🔗 @Prompts_fa'", "const TG_FOOTER = '\\n\\n@Prompts_fa'")
  s = s.replace(
    "const full = '✨ ' + ai.titleFa + '\\n\\n' + finalPrompt + '\\n\\n📘 ' + usageFa + '\\n\\n' + tagLine + TG_FOOTER",
    "const full = '✨ ' + ai.titleFa + '\\n\\n📘 ' + usageFa + '\\n\\n📝 ' + finalPrompt + '\\n\\n' + tagLine + TG_FOOTER"
  )
  s = s.replace(
    "const full = '✨ ' + pick.titleFa + '\\n\\n📘 ' + (pick.usageFa ?? '') + '\\n\\n' + tagLine + '\\n\\n🌐 ' + url + TG_FOOTER",
    "const full = '✨ ' + pick.titleFa + '\\n\\n📘 ' + (pick.usageFa ?? '') + '\\n\\n📝 ' + (pick.prompt ?? '') + '\\n\\n' + tagLine + '\\n\\n🌐 ' + url + TG_FOOTER"
  )
  fs.writeFileSync(p, s)
  console.log('✅ ' + p + ': new caption format')
}
NODEEOF

# ---------- 3) process user submits with Gemini + send ----------
cat > src/app/api/process-submit/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const p = await prisma.prompt.findUnique({ where: { id } })
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let imgBase64: string | null = null
  try {
    const ir = await fetch(p.img, { signal: AbortSignal.timeout(15000), redirect: 'follow' })
    const buf = Buffer.from(await ir.arrayBuffer())
    if (ir.ok && buf.length > 5000 && buf.length < 2_500_000) imgBase64 = buf.toString('base64')
  } catch {}

  const categories = await prisma.category.findMany()
  let ai
  try { ai = await analyzeWithGemini({ text: p.prompt, imgBase64, categories }) }
  catch { ai = await analyzeWithGemini({ text: p.prompt, imgBase64: null, categories }) }

  const finalPrompt = (ai.promptEn || p.prompt).trim()
  await prisma.prompt.update({
    where: { id },
    data: {
      titleFa: ai.titleFa, titleEn: ai.titleEn,
      descFa: ai.descFa, descEn: ai.descEn,
      usageFa: ai.usageFa, usageEn: ai.usageEn,
      tagsFa: ai.tagsFa, tagsEn: ai.tagsEn,
      prompt: finalPrompt,
      status: 'PUBLISHED',
    },
  })

  const out = process.env.TELEGRAM_OUTPUT
  let tg: any = null
  if (out) {
    const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
    const usageFa = (ai.usageFa || '').trim()
    const full = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n📝 ' + finalPrompt + '\n\n' + tagLine + '\n\n@Prompts_fa'
    const short = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + '\n\n@Prompts_fa'
    if (full.length <= 1024) tg = await tgSendPhoto(out, p.img, full)
    else {
      tg = await tgSendPhoto(out, p.img, short)
      await tgSendCode(out, finalPrompt, '\n\n@Prompts_fa')
    }
  }

  return NextResponse.json({ ok: true, slug: p.slug, tg })
}
EOF

# ---------- 4) submit triggers processing ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/submit/page.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  'const catId = String(fd.get(\'category\') ?? \'\')\n    await prisma.prompt.create({',
  'const catId = String(fd.get(\'category\') ?? \'\')\n    const created = await prisma.prompt.create({'
)

s = s.replace(
  "redirect('/?sent=1')",
  "fetch((process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/api/process-submit?id=' + created.id + '&key=' + (process.env.CRON_SECRET ?? ''), { signal: AbortSignal.timeout(8000) }).catch(() => {})\n    redirect('/?sent=1')"
)

fs.writeFileSync(p, s)
console.log('✅ submit: auto-process trigger')
NODEEOF

echo "✅ update77 done!"
