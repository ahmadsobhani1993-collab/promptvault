#!/bin/bash
set -e

# ---------- 1) advanced SEO copywriting instruction ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

const newInstruction = `const INSTRUCTION =
  'تو یک استراتژیست سئو و کپی‌رایتر ارشد فارسی‌زبان هستی؛ متخصص رتبه‌آوری در گوگل فارسی.\\n' +
  'هدف: مقاله‌ای بنویس که برای کلمه کلیدی اصلی رتبه 1 گوگل بگیرد و کاربر را تا انتها نگه دارد.\\n' +
  'اصول الزامی:\\n' +
  '1) کلمه کلیدی اصلی (keywordFa) + 6 کلمه کلیدی هم‌معنی/LSI (keywordsFa).\\n' +
  '2) عنوان (titleFa): زیر 60 کاراکتر، شامل کلمه کلیدی + عدد + کلمه قدرتمند (راهنمای کامل، بهترین روش‌ها، از صفر تا صد).\\n' +
  '3) metaDescFa: بین 140 تا 155 کاراکتر، شامل کلمه کلیدی + مزیت + دعوت به اقدام.\\n' +
  '4) مقدمه 3-4 جمله با فرمول PAS: درد کاربر + تشدید + وعده راه‌حل؛ کلمه کلیدی در جمله اول.\\n' +
  '5) بدنه حداقل 1200 کلمه با این ساختار دقیق:\\n' +
  '   ## [کلمه کلیدی] چیست؟ (تعریف ساده + بولد کلمه کلیدی)\\n' +
  '   ## چرا [هم‌معنی کلید] مهم است (3 مزیت با لیست)\\n' +
  '   ## آموزش گام‌به‌گام (5+ گام با زیرعنوان ### و یک مثال عملی واقعی در هر گام)\\n' +
  '   ## بهترین ابزارها (معرفی 4 ابزار + لینک داخلی به /explore)\\n' +
  '   ## اشتباهات رایج (لیست 4 موردی)\\n' +
  '   ## پرسش‌های متداول (4 سوال با پاسخ 2-3 جمله‌ای برای featured snippet)\\n' +
  '   ## جمع‌بندی (تکرار طبیعی کلیدی + CTA به /explore)\\n' +
  '6) کلمات LSI طبیعی پخش شوند (چگالی 1-2%)؛ عبارات مهم **بولد**؛ در صورت امکان یک جدول مقایسه‌ای.\\n' +
  '7) جملات زیر 20 کلمه؛ پاراگراف‌ها حداکثر 4 خط؛ لحن صمیمیِ متخصص؛ بدون غلط املایی.\\n' +
  '8) دو لینک داخلی مارک‌داون: [پرامپت‌های آماده هوش مصنوعی](/explore) و [دسته‌بندی‌ها](/categories).\\n' +
  'فقط و فقط یک JSON معتبر برگردان با کلیدهای دقیق:\\n' +
  '{"keywordFa","keywordEn","keywordsFa":[6],"titleFa","titleEn","slugEn","metaDescFa","descFa","contentFa","imagePromptEn"}\\n' +
  '- slugEn: lowercase english hyphenated.\\n' +
  '- imagePromptEn: detailed english prompt for a futuristic cover image about the topic.'`

s = s.replace(/const INSTRUCTION =[\s\S]*?\n\nasync function genImageFast/, newInstruction + '\n\nasync function genImageFast')
fs.writeFileSync(p, s)
console.log('✅ advanced SEO instruction')
NODEEOF

# ---------- 2) admin API: prompts + comments ----------
mkdir -p src/app/api/admin/prompts src/app/api/admin/comments

cat > src/app/api/admin/prompts/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id, action } = await req.json()

  if (action === 'publish') {
    await prisma.prompt.update({ where: { id }, data: { status: 'PUBLISHED' } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'reject') {
    await prisma.prompt.update({ where: { id }, data: { status: 'REJECTED' } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'delete') {
    await prisma.prompt.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
EOF

cat > src/app/api/admin/comments/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id, action } = await req.json()
  if (action === 'delete') {
    await prisma.comment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
EOF
echo "✅ admin APIs ready"

# ---------- 3) client action components ----------
cat > src/components/prompt-actions.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'

export default function PromptActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const act = async (action: string) => {
    await fetch('/api/admin/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    router.refresh()
  }
  return (
    <div className="flex shrink-0 gap-2">
      {status !== 'PUBLISHED' && (
        <button onClick={() => act('publish')} className="rounded-full bg-green-500/15 px-3 py-1 text-[10px] text-green-400 transition-colors hover:bg-green-500/25">✅ انتشار</button>
      )}
      {status === 'PENDING' && (
        <button onClick={() => act('reject')} className="rounded-full bg-yellow-500/15 px-3 py-1 text-[10px] text-yellow-400 transition-colors hover:bg-yellow-500/25">رد</button>
      )}
      <button onClick={() => act('delete')} className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/25">حذف</button>
    </div>
  )
}
EOF

cat > src/components/comment-actions.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'

export default function CommentActions({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'delete' }) })
        router.refresh()
      }}
      className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/25"
    >
      حذف
    </button>
  )
}
EOF
echo "✅ action components"

# ---------- 4) admin pages: prompts + comments (schema-aware) ----------
cat > src/app/admin/prompts/page.tsx << 'EOF'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import PromptActions from '@/components/prompt-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'پرامپت‌ها | مدیریت' }

const TABS = [
  { key: 'pending', fa: '🕓 در انتظار' },
  { key: 'published', fa: '✅ منتشرشده' },
  { key: 'rejected', fa: '⛔ ردشده' },
  { key: 'all', fa: 'همه' },
]

export default async function AdminPrompts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const tab = params.tab ?? 'pending'
  const q = params.q ?? ''
  const where: any = {}
  if (tab !== 'all') where.status = tab.toUpperCase()
  if (q) where.titleFa = { contains: q, mode: 'insensitive' }

  const [rows, pendingCount] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60, include: { category: true } }),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
  ])

  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📦 پرامپت‌ها {pendingCount > 0 && <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">{pendingCount} در انتظار</span>}</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <form className="mt-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="جستجوی عنوان..." className="input text-xs" />
        {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
        <button className="btn-secondary text-xs">جستجو</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={'/admin/prompts?tab=' + t.key} className={chip(tab === t.key)}>{t.fa}</Link>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={'/prompts/' + p.slug} className="block truncate text-xs font-bold text-ink transition-colors hover:text-gold-bright">{p.titleFa}</Link>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {p.category?.nameFa ?? '—'} · ❤ {p.likes} · 👁 {p.views} · {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(p.createdAt)}
                </p>
              </div>
              <PromptActions id={p.id} status={p.status} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">موردی نیست.</p>}
        </div>
      </div>
    </section>
  )
}
EOF

node << 'NODEEOF'
const fs = require('fs')
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
function fields(name) {
  const m = schema.match(new RegExp('model ' + name + ' \\{([\\s\\S]*?)\\n\\}'))
  if (!m) return []
  return m[1].split('\n').map((l) => { const f = l.trim().match(/^(\w+)/); return f ? f[1] : null }).filter(Boolean)
}
const cf = fields('Comment')
const textField = ['text', 'content', 'body', 'message'].find((f) => cf.includes(f)) || 'text'
const hasUser = cf.includes('userId')
const hasPrompt = cf.includes('promptId')
const hasArticle = cf.includes('articleId')
console.log('Comment fields:', cf.join(', '))

const page = `import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import CommentActions from '@/components/comment-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'کامنت‌ها | مدیریت' }

export default async function AdminComments() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const rows = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: { ${hasUser ? 'user: true,' : ''} ${hasPrompt ? 'prompt: true,' : ''} ${hasArticle ? 'article: true,' : ''} },
  })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">💬 کامنت‌ها ({rows.length})</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((c: any) => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs leading-6 text-ink">{c.${textField}}</p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {c.user?.name ?? 'کاربر'} · روی: {c.prompt?.titleFa ?? c.article?.titleFa ?? '—'} · {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(c.createdAt)}
                </p>
              </div>
              <CommentActions id={c.id} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">کامنتی نیست.</p>}
        </div>
      </div>
    </section>
  )
}
`
fs.writeFileSync('src/app/admin/comments/page.tsx', page)
console.log('✅ admin comments page (schema-aware)')
NODEEOF

# ---------- 5) full admin nav everywhere ----------
node << 'NODEEOF'
const fs = require('fs')
const files = ['src/app/admin/page.tsx', 'src/app/admin/analytics/page.tsx', 'src/app/admin/categories/page.tsx', 'src/app/admin/users/page.tsx']
for (const p of files) {
  if (!fs.existsSync(p)) continue
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('/admin/analytics')) {
    s = s.replace(/\{\s*href:\s*'\/admin\/prompts'/, "{ href: '/admin/analytics', label: '📊 آمار بازدید' },\n    { href: '/admin/prompts'")
    fs.writeFileSync(p, s)
    console.log('✅ nav fixed: ' + p)
  }
}
NODEEOF

echo "✅ update117 done!"