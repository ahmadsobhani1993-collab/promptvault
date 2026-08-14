#!/bin/bash
set -e

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

enum PromptStatus {
  PENDING
  PUBLISHED
  REJECTED
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

cat > src/lib/data.ts << 'EOF'
import type { Locale } from '@/lib/i18n'
import { prisma } from '@/lib/db'

export const L = (locale: Locale, fa: string, en: string) =>
  locale === 'fa' ? fa : en

export interface PromptType {
  value: string
  fa: string
  en: string
}

export const promptTypes: PromptType[] = [
  { value: 'IMAGE', fa: 'تصویر', en: 'Image' },
  { value: 'VIDEO', fa: 'ویدیو', en: 'Video' },
  { value: 'TEXT', fa: 'متن', en: 'Text' },
  { value: 'CODE', fa: 'کد', en: 'Code' },
  { value: 'AUDIO', fa: 'موسیقی', en: 'Music' },
]

export const getPromptTypeLabel = (type: string, locale: Locale) => {
  const t = promptTypes.find((x) => x.value === type)
  return t ? L(locale, t.fa, t.en) : type
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { subs: true },
  })
}

export async function getPrompts(opts?: {
  type?: string
  q?: string
  categorySlug?: string
  subSlug?: string
  take?: number
}) {
  const where: any = { status: 'PUBLISHED' }
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) where.category = { slug: opts.categorySlug }
  if (opts?.subSlug) where.sub = { slug: opts.subSlug }
  if (opts?.q) {
    const q = opts.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
    ]
  }

  return prisma.prompt.findMany({
    where,
    orderBy: { likes: 'desc' },
    take: opts?.take,
    include: { category: true, sub: true },
  })
}

export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true },
  })
}

export async function getRelatedPrompts(categoryId: string, excludeSlug: string) {
  return prisma.prompt.findMany({
    where: { categoryId, status: 'PUBLISHED', NOT: { slug: excludeSlug } },
    orderBy: { likes: 'desc' },
    take: 3,
    include: { category: true, sub: true },
  })
}

export async function getArticles() {
  return prisma.article.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({ where: { slug } })
}
EOF

cat > src/app/submit/actions.ts << 'EOF'
'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function tags(str: string) {
  return ((str as string) || '').split(/[,،]/).map((t) => t.trim()).filter(Boolean)
}

export async function createSubmit(fd: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const titleFa = fd.get('titleFa') as string
  const titleEn = ((fd.get('titleEn') as string) || titleFa)

  await prisma.prompt.create({
    data: {
      titleFa,
      titleEn,
      slug: slugify(titleEn) + '-' + Date.now().toString(36),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt: fd.get('prompt') as string,
      status: 'PENDING',
      userId: session.user.id,
    },
  })

  revalidatePath('/admin', 'layout')
  redirect('/submit?done=1')
}
EOF

cat > src/app/submit/page.tsx << 'EOF'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { type Locale, L } from '@/lib/i18n'
import { createSubmit } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ارسال پرامپت' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>
}) {
  const { done } = await searchParams
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const categories = await prisma.category.findMany({ include: { subs: true } })

  return (
    <section className="container-app max-w-3xl py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'ارسال پرامپت', 'Submit Prompt')}
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'پرامپت تو بعد از بررسی و تأیید ادمین، در سایت منتشر می‌شود و به نام تو ثبت خواهد شد.',
          'Your prompt will be published under your name after admin approval.'
        )}
      </p>

      {done && (
        <div className="glow-gold mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 text-sm text-success">
          {L(
            locale,
            '✅ پرامپت تو با موفقیت ثبت شد و در صف بررسی است. بعد از تأیید، در سایت نمایش داده می‌شود.',
            '✅ Your prompt was submitted and is pending review.'
          )}
        </div>
      )}

      <form action={createSubmit} className="card mt-8 grid gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="titleFa" placeholder={L(locale, 'عنوان فارسی *', 'Persian title *')} className="input" required />
          <input name="titleEn" placeholder={L(locale, 'عنوان انگلیسی (اختیاری)', 'English title (optional)')} className="input" />
        </div>

        <input name="img" placeholder={L(locale, 'آدرس تصویر خروجی (https://...) *', 'Output image URL *')} className="input" required />

        <div className="grid gap-4 sm:grid-cols-3">
          <input name="model" placeholder={L(locale, 'مدل AI (Midjourney...) *', 'AI model *')} className="input" required />
          <select name="type" className="input">
            <option value="IMAGE">{L(locale, 'تصویر', 'Image')}</option>
            <option value="VIDEO">{L(locale, 'ویدیو', 'Video')}</option>
            <option value="TEXT">{L(locale, 'متن', 'Text')}</option>
            <option value="CODE">{L(locale, 'کد', 'Code')}</option>
            <option value="AUDIO">{L(locale, 'موسیقی', 'Music')}</option>
          </select>
          <select name="categoryId" className="input" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
            ))}
          </select>
        </div>

        <select name="subId" className="input">
          <option value="">{L(locale, 'بدون زیردسته', 'No subcategory')}</option>
          {categories.flatMap((c) => c.subs).map((s) => (
            <option key={s.id} value={s.id}>{L(locale, s.fa, s.en)}</option>
          ))}
        </select>

        <div className="grid gap-4 sm:grid-cols-2">
          <input name="tagsFa" placeholder={L(locale, 'تگ فارسی (با ، جدا کن)', 'Persian tags')} className="input" />
          <input name="tagsEn" placeholder="tags (comma separated)" className="input" />
        </div>

        <textarea
          name="prompt"
          placeholder={L(locale, 'متن کامل پرامپت *', 'Full prompt text *')}
          rows={7}
          className="input resize-none font-mono"
          dir="ltr"
          required
        />

        <button type="submit" className="btn-primary w-fit">
          {L(locale, 'ارسال برای بررسی', 'Submit for review')}
        </button>
      </form>
    </section>
  )
}
EOF

cat > src/app/admin/review-actions.ts << 'EOF'
'use server'

import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function approvePrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.update({ where: { id }, data: { status: 'PUBLISHED' } })
  revalidatePath('/', 'layout')
}

export async function rejectPrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.update({ where: { id }, data: { status: 'REJECTED' } })
  revalidatePath('/', 'layout')
}
EOF

cat > src/app/admin/prompts/page.tsx << 'EOF'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deletePrompt } from '@/app/admin/actions'
import { approvePrompt, rejectPrompt } from '@/app/admin/review-actions'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, { fa: string; cls: string }> = {
  PUBLISHED: { fa: 'منتشرشده', cls: 'text-success border-success/40 bg-success/10' },
  PENDING: { fa: 'در انتظار بررسی', cls: 'text-warning border-warning/40 bg-warning/10' },
  REJECTED: { fa: 'ردشده', cls: 'text-danger border-danger/40 bg-danger/10' },
}

export default async function AdminPrompts() {
  await requireAdmin()
  const prompts = await prisma.prompt.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: true, user: true },
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">پرامپت‌ها</h1>
        <Link href="/admin/prompts/new" className="btn-primary">+ پرامپت جدید</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-ink-muted">
              <th className="p-4">عنوان</th>
              <th className="p-4">ارسال‌کننده</th>
              <th className="p-4">وضعیت</th>
              <th className="p-4">لایک</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => {
              const st = statusLabel[p.status] ?? statusLabel.PUBLISHED
              return (
                <tr key={p.id} className="border-b border-line/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={p.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="line-clamp-1">{p.titleFa}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-ink-muted">{p.user?.name ?? 'ادمین'}</td>
                  <td className="p-4">
                    <span className={'rounded-full border px-2 py-0.5 text-[10px] ' + st.cls}>{st.fa}</span>
                  </td>
                  <td className="p-4 text-ink-muted">{p.likes}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === 'PENDING' && (
                        <>
                          <form action={approvePrompt.bind(null, p.id)}>
                            <button type="submit" className="rounded-xl border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">تأیید</button>
                          </form>
                          <form action={rejectPrompt.bind(null, p.id)}>
                            <button type="submit" className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-warning">رد</button>
                          </form>
                        </>
                      )}
                      {p.status === 'REJECTED' && (
                        <form action={approvePrompt.bind(null, p.id)}>
                          <button type="submit" className="rounded-xl border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">انتشار</button>
                        </form>
                      )}
                      <Link href={'/admin/prompts/' + p.id + '/edit'} className="btn-secondary px-3 py-1 text-xs">ویرایش</Link>
                      <form action={deletePrompt.bind(null, p.id)}>
                        <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
EOF

echo "✅ Submit page + review workflow ready!"