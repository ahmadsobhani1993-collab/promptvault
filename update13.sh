#!/bin/bash
set -e

mkdir -p src/app/api/saves

cat > prisma/schema.prisma << 'EOF'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
}

enum PromptType {
  IMAGE
  VIDEO
  TEXT
  CODE
  AUDIO
}

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
  id         String     @id @default(cuid())
  slug       String     @unique
  titleFa    String
  titleEn    String
  img        String
  model      String
  type       PromptType @default(IMAGE)
  categoryId String
  subId      String?
  tagsFa     String[]
  tagsEn     String[]
  prompt     String     @db.Text
  likes      Int        @default(0)
  saves      Int        @default(0)
  views      Int        @default(0)
  createdAt  DateTime   @default(now())
  category   Category   @relation(fields: [categoryId], references: [id])
  sub        Sub?       @relation(fields: [subId], references: [id])
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

cat > src/components/save-button.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function SaveButton({
  promptId,
  initialSaved,
  initialCount,
  label,
  requireLogin,
}: {
  promptId: string
  initialSaved: boolean
  initialCount: number
  label: string
  requireLogin: string
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [count, setCount] = useState(initialCount)

  const toggle = async () => {
    const next = !saved
    setSaved(next)
    setCount((c) => c + (next ? 1 : -1))
    const res = await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, action: next ? 'save' : 'unsave' }),
    })
    if (res.status === 401) {
      alert(requireLogin)
      setSaved(!next)
      setCount((c) => c + (next ? -1 : 1))
      window.location.href = '/login'
    }
  }

  return (
    <button type="button" onClick={toggle} className={saved ? 'btn-primary' : 'btn-secondary'}>
      <svg
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {count} {label}
    </button>
  )
}
EOF

cat > src/app/api/saves/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { promptId, action } = await req.json()
  if (!promptId || !['save', 'unsave'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const userId = session.user.id

  if (action === 'save') {
    await prisma.save.create({ data: { userId, promptId } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { saves: { increment: 1 } },
    }).catch(() => {})
  } else {
    await prisma.save.delete({ where: { userId_promptId: { userId, promptId } } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { saves: { decrement: 1 } },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return { title: item.titleFa, description: item.prompt.slice(0, 150) }
}

export const dynamic = 'force-dynamic'

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
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
    liked = !!(await prisma.like.findUnique({
      where: { userId_promptId: { userId, promptId: item.id } },
    }))
    saved = !!(await prisma.save.findUnique({
      where: { userId_promptId: { userId, promptId: item.id } },
    }))
  }

  const comments = await prisma.comment.findMany({
    where: { promptId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RealLikeButton
              promptId={item.id}
              initialLiked={liked}
              initialCount={item.likes}
              label={L(locale, 'پسند', 'likes')}
              requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')}
            />
            <SaveButton
              promptId={item.id}
              initialSaved={saved}
              initialCount={item.saves}
              label={L(locale, 'ذخیره', 'saves')}
              requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">
              {item.prompt}
            </p>
            <div className="mt-5">
              <CopyButton
                text={item.prompt}
                label={L(locale, 'کپی پرامپت', 'Copy Prompt')}
                copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
              />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {L(locale, 'پرامپت‌های مشابه', 'Related prompts')}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <RealCommentBox
        initial={comments.map((c) => ({
          id: c.id,
          name: c.user?.name ?? c.name,
          image: c.user?.image ?? null,
          text: c.text,
          createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
        }))}
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

cat > 'src/app/blog/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getArticleBySlug, getArticles, getPrompts, L } from '@/lib/data'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import PromptCard from '@/components/prompt-card'
import RealCommentBox from '@/components/real-comment-box'

const relatedMap: Record<string, { fa: string; en: string }[]> = {
  'midjourney-starter': [{ fa: 'سینمایی', en: 'cinematic' }, { fa: 'محصول', en: 'product' }],
  'better-prompts': [{ fa: 'تبلیغات', en: 'ads' }, { fa: 'فانتزی', en: 'fantasy' }],
  'flux-vs-sd': [{ fa: 'لوکس', en: 'luxury' }, { fa: 'آینده', en: 'future' }],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticleBySlug(slug)
  if (!a) return {}
  return { title: a.titleFa, description: a.descFa }
}

export const dynamic = 'force-dynamic'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const userId = session?.user?.id

  const a = await getArticleBySlug(slug)
  if (!a) notFound()

  const allArticles = await getArticles()
  const others = allArticles.filter((x) => x.slug !== slug)
  const content = locale === 'fa' ? a.contentFa : a.contentEn

  const keywords = relatedMap[slug] ?? []
  let related: any[] = []
  if (keywords.length > 0) {
    const allPrompts = await getPrompts()
    related = allPrompts
      .filter((p) => {
        const tags = locale === 'fa' ? p.tagsFa : p.tagsEn
        return keywords.some((k) => tags.some((t) => t.toLowerCase() === k[locale].toLowerCase()))
      })
      .slice(0, 3)
  }

  const comments = await prisma.comment.findMany({
    where: { articleId: a.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  return (
    <article className="container-app max-w-4xl py-16">
      <Link href="/blog" className="text-xs text-gold-bright hover:text-gold">
        {L(locale, '← بازگشت به وبلاگ', '← Back to blog')}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={'/explore?q=' + encodeURIComponent(L(locale, a.tagFa, a.tagEn))}
          className="gold-badge transition-colors hover:bg-gold/20"
        >
          {L(locale, a.tagFa, a.tagEn)}
        </Link>
        <span className="text-xs text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
        <span className="text-xs text-ink-faint">{L(locale, a.readFa, a.readEn)}</span>
      </div>

      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {L(locale, a.titleFa, a.titleEn)}
      </h1>

      <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="glow-gold mt-8 w-full rounded-2xl object-cover" />

      <div className="mt-8 space-y-6">
        {content.map((p, i) => (
          <p key={i} className="text-base leading-8 text-ink-muted">{p}</p>
        ))}
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {L(locale, 'پرامپت‌های مرتبط', 'Related prompts')}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {L(locale, 'سایر مقالات', 'More articles')}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Link key={o.id} href={'/blog/' + o.slug} className="card flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
              <img src={o.img} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <p className="line-clamp-1 text-sm font-bold text-ink">{L(locale, o.titleFa, o.titleEn)}</p>
                <p className="mt-1 text-[10px] text-ink-faint">{L(locale, o.readFa, o.readEn)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <RealCommentBox
        initial={comments.map((c) => ({
          id: c.id,
          name: c.user?.name ?? c.name,
          image: c.user?.image ?? null,
          text: c.text,
          createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
        }))}
        targetId={a.id}
        targetType="article"
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
        loginRequired={L(locale, 'برای ارسال دیدگاه ابتدا وارد شو', 'Login to comment')}
        isLoggedIn={!!userId}
      />
    </article>
  )
}
EOF

echo "✅ Real likes/saves/comments + guest redirect to login!"