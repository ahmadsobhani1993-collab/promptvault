#!/bin/bash
set -e

mkdir -p src/app/api/cron

cat > prisma/schema-add.prisma << 'EOF'
EOF
rm -f prisma/schema-add.prisma

python3 - << 'PYEOF' 2>/dev/null || node - << 'JSEOF'
PYEOF
JSEOF

cat > /tmp/patch.txt << 'EOF'
placeholder
EOF
rm -f /tmp/patch.txt

cat > prisma/schema.prisma << 'EOF'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role { USER ADMIN }
enum PromptType { IMAGE VIDEO TEXT CODE AUDIO }
enum PromptStatus { PENDING PUBLISHED REJECTED }

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  accounts      Account[]
  sessions      Session[]
  comments      Comment[]
  likes         Like[]
  saves         Save[]
  prompts       Prompt[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Setting {
  key   String @id
  value String
}

model TelegramQueue {
  id        Int      @id
  text      String?
  img       String?
  reply     Boolean  @default(false)
  status    String   @default("PENDING")
  promptId  String?
  createdAt DateTime @default(now())
}

model Category {
  id      String   @id @default(cuid())
  slug    String   @unique
  nameFa  String
  nameEn  String
  icon    String
  descFa  String
  descEn  String
  order   Int      @default(0)
  subs    Sub[]
  prompts Prompt[]
}

model Sub {
  id         String   @id @default(cuid())
  slug       String
  fa         String
  en         String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  prompts    Prompt[]
  @@unique([categoryId, slug])
}

model Prompt {
  id         String       @id @default(cuid())
  slug       String       @unique
  titleFa    String
  titleEn    String
  descFa     String?
  descEn     String?
  usageFa    String?
  usageEn    String?
  img        String
  model      String
  type       PromptType   @default(IMAGE)
  status     PromptStatus @default(PUBLISHED)
  categoryId String
  subId      String?
  userId     String?
  tagsFa     String[]
  tagsEn     String[]
  prompt     String       @db.Text
  likes      Int          @default(0)
  saves      Int          @default(0)
  views      Int          @default(0)
  createdAt  DateTime     @default(now())
  category   Category     @relation(fields: [categoryId], references: [id])
  sub        Sub?         @relation(fields: [subId], references: [id])
  user       User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  comments   Comment[]
  userLikes  Like[]
  userSaves  Save[]
}

model Article {
  id        String    @id @default(cuid())
  slug      String    @unique
  titleFa   String
  titleEn   String
  descFa    String
  descEn    String
  img       String
  tagFa     String
  tagEn     String
  dateFa    String
  dateEn    String
  readFa    String
  readEn    String
  contentFa String[]
  contentEn String[]
  createdAt DateTime  @default(now())
  comments  Comment[]
}

model Comment {
  id        String   @id @default(cuid())
  name      String
  text      String
  createdAt DateTime @default(now())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  promptId  String?
  prompt    Prompt?  @relation(fields: [promptId], references: [id], onDelete: Cascade)
  articleId String?
  article   Article? @relation(fields: [articleId], references: [id], onDelete: Cascade)
}

model Like {
  id       String @id @default(cuid())
  userId   String
  promptId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  prompt   Prompt @relation(fields: [promptId], references: [id], onDelete: Cascade)
  @@unique([userId, promptId])
}

model Save {
  id       String @id @default(cuid())
  userId   String
  promptId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  prompt   Prompt @relation(fields: [promptId], references: [id], onDelete: Cascade)
  @@unique([userId, promptId])
}
EOF

cat > src/lib/telegram.ts << 'EOF'
export type TgMessage = {
  id: number
  text: string
  img: string | null
  reply: boolean
}

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

export function parsePage(html: string): TgMessage[] {
  const parts = html.split('<div class="tgme_widget_message')
  const out: TgMessage[] = []
  for (const p of parts.slice(1)) {
    const idm = p.match(/data-post="[^"]*\/(\d+)"/)
    if (!idm) continue
    const textM = p.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgM = p.match(/background-image:url\('([^']+)'\)/)
    let img: string | null = null
    if (imgM) img = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]
    out.push({
      id: parseInt(idm[1], 10),
      text: textM ? decode(textM[1]) : '',
      img,
      reply: p.includes('tgme_widget_message_reply'),
    })
  }
  return out
}

export async function fetchPage(username: string, before?: number): Promise<TgMessage[]> {
  const url = 'https://t.me/s/' + username + (before ? '?before=' + before : '')
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  return parsePage(await res.text())
}

const TG = () => 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN

export async function tgSendText(chat: string, text: string) {
  await fetch(TG() + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
  })
}

export async function tgSendFile(chat: string, filename: string, content: string) {
  const form = new FormData()
  form.append('chat_id', chat)
  form.append('document', new Blob([content], { type: 'text/plain' }), filename)
  await fetch(TG() + '/sendDocument', { method: 'POST', body: form })
}
EOF

cat > src/lib/gemini.ts << 'EOF'
export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' },
  { fa: 'محصول', en: 'product' },
  { fa: 'سینمایی', en: 'cinematic' },
  { fa: 'فانتزی', en: 'fantasy' },
  { fa: 'انیمه', en: 'anime' },
  { fa: 'واقع‌گرایانه', en: 'photorealistic' },
  { fa: 'مینیمال', en: 'minimal' },
  { fa: 'لوکس', en: 'luxury' },
  { fa: 'تاریک', en: 'dark' },
  { fa: 'نئون', en: 'neon' },
  { fa: 'طبیعت', en: 'nature' },
  { fa: 'معماری', en: 'architecture' },
  { fa: 'کاراکتر', en: 'character' },
  { fa: 'لوگو', en: 'logo' },
  { fa: 'پوستر', en: 'poster' },
  { fa: 'تبلیغات', en: 'ads' },
  { fa: 'آموزش', en: 'tutorial' },
  { fa: 'کد', en: 'code' },
  { fa: 'نویسندگی', en: 'writing' },
  { fa: 'بهره‌وری', en: 'productivity' },
  { fa: 'موسیقی', en: 'music' },
  { fa: 'ویدیو', en: 'video' },
  { fa: 'عکاسی', en: 'photography' },
  { fa: 'سه‌بعدی', en: '3d' },
  { fa: 'رنگی', en: 'colorful' },
]

export type GeminiResult = {
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  usageFa: string
  usageEn: string
  categorySlug: string
  tagsFa: string[]
  tagsEn: string[]
}

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  categories: { slug: string; fa: string; en: string }[]
}): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'

  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn"\n' +
    '- titleFa/titleEn: short catchy title (fa/en).\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\n' +
    '- tagsFa: choose MAX 4 from ONLY this list: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: the English equivalents of the chosen tagsFa, same order: ' +
    TAG_VOCAB.map((t) => t.en).join(', ')

  const parts: any[] = [{ text: instruction + '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)') }]
  if (opts.imgBase64) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: opts.imgBase64 } })
  }

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  )

  const json = await res.json()
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  const parsed = m ? JSON.parse(m[0]) : {}

  const tagsFa: string[] = (parsed.tagsFa ?? []).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa: string) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })

  const catOk = opts.categories.some((c) => c.slug === parsed.categorySlug)

  return {
    titleFa: parsed.titleFa || 'پرامپت هوش مصنوعی',
    titleEn: parsed.titleEn || 'AI Prompt',
    descFa: parsed.descFa || '',
    descEn: parsed.descEn || '',
    usageFa: parsed.usageFa || '',
    usageEn: parsed.usageEn || '',
    categorySlug: catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image',
    tagsFa,
    tagsEn,
  }
}
EOF

cat > src/app/api/cron/telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, tgSendText, tgSendFile } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const channel = process.env.TELEGRAM_CHANNEL
  if (!channel) return NextResponse.json({ error: 'no channel' }, { status: 500 })

  const synced = await getSetting('tg_synced', '0')

  // ---------- PHASE 1: build queue from oldest post ----------
  if (synced !== '1') {
    let before = parseInt(await getSetting('tg_before', '0'), 10)

    if (before === 0) {
      const first = await fetchPage(channel)
      if (first.length === 0) return NextResponse.json({ ok: true, phase: 'sync', msg: 'empty channel' })
      const minId = Math.min(...first.map((m) => m.id))
      for (const msg of first) {
        await prisma.telegramQueue.upsert({
          where: { id: msg.id },
          update: {},
          create: { id: msg.id, text: msg.text, img: msg.img, reply: msg.reply },
        })
      }
      before = minId
      await setSetting('tg_before', String(before))
    }

    const page = await fetchPage(channel, before)
    if (page.length === 0) {
      await setSetting('tg_synced', '1')
      return NextResponse.json({ ok: true, phase: 'sync-done' })
    }

    const minId = Math.min(...page.map((m) => m.id))
    for (const msg of page) {
      await prisma.telegramQueue.upsert({
        where: { id: msg.id },
        update: {},
        create: { id: msg.id, text: msg.text, img: msg.img, reply: msg.reply },
      })
    }
    await setSetting('tg_before', String(minId))
    return NextResponse.json({ ok: true, phase: 'sync', got: page.length, before: minId })
  }

  // ---------- PHASE 2: process one post per tick ----------
  const item = await prisma.telegramQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
  })
  if (!item) return NextResponse.json({ ok: true, phase: 'idle', msg: 'all processed' })

  try {
    let promptText = item.text ?? ''
    let img = item.img
    const skipIds: number[] = []

    // reply/continuation detection: photo without text + next message with text
    if (img && promptText.length < 40) {
      const next = await prisma.telegramQueue.findFirst({
        where: { id: { gt: item.id }, status: 'PENDING' },
        orderBy: { id: 'asc' },
      })
      if (next && !next.img && (next.text ?? '').length > 40) {
        promptText = next.text ?? ''
        skipIds.push(next.id)
      }
    }
    // text-only reply to a photo above
    if (!img && promptText && item.reply) {
      const prev = await prisma.telegramQueue.findFirst({
        where: { id: { lt: item.id }, img: { not: null } },
        orderBy: { id: 'desc' },
      })
      if (prev && prev.id >= item.id - 3) {
        img = prev.img
      }
    }

    if (!promptText && !img) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-empty' })
    }

    // download image for Gemini
    let imgBase64: string | null = null
    if (img) {
      try {
        const ir = await fetch(img)
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    const categories = await prisma.category.findMany()
    const ai = await analyzeWithGemini({ text: promptText, imgBase64, categories })

    const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

    const prompt = await prisma.prompt.create({
      data: {
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        slug: 'tg-' + item.id,
        img: img ?? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        model: /--v\s?\d|--ar/.test(promptText) ? 'Midjourney' : 'AI',
        type: img ? 'IMAGE' : 'TEXT',
        status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: promptText || ai.titleEn,
      },
    })

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) {
      await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })
    }

    // ---------- send formatted version back to Telegram ----------
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      await tgSendText(out, '✨ ' + ai.titleFa)
      await tgSendFile(out, 'prompt-' + item.id + '.txt', promptText || ai.titleEn)
      await tgSendText(
        out,
        '📘 راهنمای استفاده:\n' + (ai.usageFa || '—') + '\n\n📘 How to use:\n' + (ai.usageEn || '—') + '\n\n🆔 ' + out + ' ⭐'
      )
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

cat > 'src/app/prompts/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getPromptBySlug, getRelatedPrompts, getPromptTypeLabel, L } from '@/lib/data'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import PromptCard from '@/components/prompt-card'
import CopyButton from '@/components/copy-button'
import RealLikeButton from '@/components/real-like-button'
import SaveButton from '@/components/save-button'
import RealCommentBox from '@/components/real-comment-box'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return { title: item.titleFa, description: (item.descFa ?? item.prompt).slice(0, 150) }
}

export const dynamic = 'force-dynamic'

export default async function PromptDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()

  const item = await getPromptBySlug(slug)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId, slug)

  const userId = session?.user?.id
  let liked = false
  let saved = false
  if (userId) {
    liked = !!(await prisma.like.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
    saved = !!(await prisma.save.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
  }

  const comments = await prisma.comment.findMany({
    where: { promptId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  const desc = L(locale, item.descFa ?? '', item.descEn ?? '')
  const usage = L(locale, item.usageFa ?? '', item.usageEn ?? '')

  return (
    <section className="container-app py-16">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + item.category.slug} className="gold-badge">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>

          {desc && <p className="mt-4 text-sm leading-7 text-ink-muted">{desc}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RealLikeButton promptId={item.id} initialLiked={liked} initialCount={item.likes} label={L(locale, 'پسند', 'likes')} requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')} />
            <SaveButton promptId={item.id} initialSaved={saved} initialCount={item.saves} label={L(locale, 'ذخیره', 'saves')} requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{item.prompt}</p>
            <div className="mt-5">
              <CopyButton text={item.prompt} label={L(locale, 'کپی پرامپت', 'Copy Prompt')} copiedLabel={L(locale, 'کپی شد!', 'Copied!')} />
            </div>
          </div>

          {usage && (
            <div className="mt-6 rounded-2xl border border-line bg-elevated p-5">
              <p className="text-xs font-bold text-gold-bright">
                {L(locale, '📘 راهنمای استفاده', '📘 How to use')}
              </p>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{usage}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight">{L(locale, 'پرامپت‌های مشابه', 'Related prompts')}</h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <RealCommentBox
        initial={comments.map((c) => ({ id: c.id, name: c.user?.name ?? c.name, image: c.user?.image ?? null, text: c.text, createdAt: new Date(c.createdAt).toLocaleString('fa-IR') }))}
        targetId={item.id}
        targetType="prompt"
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
        loginRequired={L(locale, 'برای ارسال دیدگاه ابتدا وارد شو', 'Login to comment')}
        isLoggedIn={!!userId}
      />
    </section>
  )
}
EOF

echo "✅ Telegram → Gemini → Website → Telegram pipeline ready!"