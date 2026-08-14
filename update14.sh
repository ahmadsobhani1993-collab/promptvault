#!/bin/bash
set -e

mkdir -p src/app/admin/prompts/new 'src/app/admin/prompts/[id]/edit' src/app/admin/articles/new src/app/admin/categories src/app/admin/comments src/components/admin

cat > src/types/next-auth.d.ts << 'EOF'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: string
    } & DefaultSession['user']
  }
}
EOF

cat > src/auth.ts << 'EOF'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        let role = (user as any).role ?? 'USER'
        if (
          process.env.ADMIN_EMAIL &&
          session.user.email === process.env.ADMIN_EMAIL &&
          role !== 'ADMIN'
        ) {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
          role = 'ADMIN'
        }
        session.user.role = role
      }
      return session
    },
  },
})
EOF

cat > src/lib/admin.ts << 'EOF'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')
  return session
}
EOF

cat > src/app/admin/layout.tsx << 'EOF'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

const items = [
  { href: '/admin', fa: 'داشبورد', en: 'Dashboard' },
  { href: '/admin/prompts', fa: 'پرامپت‌ها', en: 'Prompts' },
  { href: '/admin/articles', fa: 'مقالات', en: 'Articles' },
  { href: '/admin/categories', fa: 'دسته‌بندی‌ها', en: 'Categories' },
  { href: '/admin/comments', fa: 'کامنت‌ها', en: 'Comments' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <div className="container-app flex gap-8 py-10">
      <aside className="w-52 shrink-0">
        <p className="gold-badge mb-4">Admin</p>
        <nav className="flex flex-col gap-2">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="rounded-xl border border-line bg-elevated px-4 py-2.5 text-sm text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
            >
              {locale === 'fa' ? i.fa : i.en}
            </Link>
          ))}
          <Link href="/" className="mt-4 text-xs text-ink-faint hover:text-gold-bright">
            {locale === 'fa' ? '← بازگشت به سایت' : '← Back to site'}
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
EOF

cat > src/app/admin/actions.ts << 'EOF'
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function tags(str: string) {
  return str.split(/[,،]/).map((t) => t.trim()).filter(Boolean)
}

export async function createPrompt(fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  await prisma.prompt.create({
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt: fd.get('prompt') as string,
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/prompts')
}

export async function updatePrompt(id: string, fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  await prisma.prompt.update({
    where: { id },
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt: fd.get('prompt') as string,
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/prompts')
}

export async function deletePrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function createArticle(fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  const lines = (s: string) => (s as string).split('\n').map((x) => x.trim()).filter(Boolean)
  await prisma.article.create({
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      descFa: fd.get('descFa') as string,
      descEn: fd.get('descEn') as string,
      img: fd.get('img') as string,
      tagFa: fd.get('tagFa') as string,
      tagEn: fd.get('tagEn') as string,
      dateFa: fd.get('dateFa') as string,
      dateEn: fd.get('dateEn') as string,
      readFa: fd.get('readFa') as string,
      readEn: fd.get('readEn') as string,
      contentFa: lines(fd.get('contentFa') as string),
      contentEn: lines(fd.get('contentEn') as string),
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/articles')
}

export async function deleteArticle(id: string) {
  await requireAdmin()
  await prisma.article.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function createCategory(fd: FormData) {
  await requireAdmin()
  const subsRaw = (fd.get('subs') as string) || ''
  const subs = subsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [slug, fa, en] = l.split('|').map((x) => x?.trim())
      return { slug: slugify(slug || fa), fa, en: en || fa }
    })
  await prisma.category.create({
    data: {
      slug: slugify(fd.get('slug') as string || (fd.get('nameEn') as string)),
      nameFa: fd.get('nameFa') as string,
      nameEn: fd.get('nameEn') as string,
      icon: fd.get('icon') as string,
      descFa: fd.get('descFa') as string,
      descEn: fd.get('descEn') as string,
      subs: { create: subs },
    },
  })
  revalidatePath('/', 'layout')
}

export async function deleteCategory(id: string) {
  await requireAdmin()
  await prisma.category.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function deleteComment(id: string) {
  await requireAdmin()
  await prisma.comment.delete({ where: { id } })
  revalidatePath('/', 'layout')
}
EOF

cat > src/components/admin/prompt-form.tsx << 'EOF'
import { createPrompt, updatePrompt } from '@/app/admin/actions'

type Cat = { id: string; nameFa: string; nameEn: string; subs: { id: string; fa: string; en: string; slug: string }[] }

export default function PromptForm({
  categories,
  initial,
  locale,
}: {
  categories: Cat[]
  initial?: any
  locale: 'fa' | 'en'
}) {
  const action = initial ? updatePrompt.bind(null, initial.id) : createPrompt

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="titleFa" defaultValue={initial?.titleFa ?? ''} placeholder="عنوان فارسی" className="input" required />
        <input name="titleEn" defaultValue={initial?.titleEn ?? ''} placeholder="Title (English)" className="input" required />
      </div>
      <input name="slug" defaultValue={initial?.slug ?? ''} placeholder="slug (اختیاری - خودکار)" className="input" />
      <input name="img" defaultValue={initial?.img ?? ''} placeholder="آدرس تصویر (https://...)" className="input" required />
      <div className="grid gap-4 sm:grid-cols-3">
        <input name="model" defaultValue={initial?.model ?? ''} placeholder="مدل (Midjourney...)" className="input" required />
        <select name="type" defaultValue={initial?.type ?? 'IMAGE'} className="input">
          <option value="IMAGE">تصویر</option>
          <option value="VIDEO">ویدیو</option>
          <option value="TEXT">متن</option>
          <option value="CODE">کد</option>
          <option value="AUDIO">موسیقی</option>
        </select>
        <select name="categoryId" defaultValue={initial?.categoryId ?? categories[0]?.id} className="input" required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameFa}</option>
          ))}
        </select>
      </div>
      <select name="subId" defaultValue={initial?.subId ?? ''} className="input">
        <option value="">بدون زیردسته</option>
        {categories.flatMap((c) => c.subs).map((s) => (
          <option key={s.id} value={s.id}>{s.fa}</option>
        ))}
      </select>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="tagsFa" defaultValue={(initial?.tagsFa ?? []).join('، ')} placeholder="تگ‌های فارسی (با ، جدا کن)" className="input" />
        <input name="tagsEn" defaultValue={(initial?.tagsEn ?? []).join(', ')} placeholder="tags (comma separated)" className="input" />
      </div>
      <textarea name="prompt" defaultValue={initial?.prompt ?? ''} placeholder="متن کامل پرامپت..." rows={6} className="input resize-none font-mono" required dir="ltr" />
      <button type="submit" className="btn-primary w-fit">
        {locale === 'fa' ? 'ذخیره' : 'Save'}
      </button>
    </form>
  )
}
EOF

cat > src/components/admin/article-form.tsx << 'EOF'
import { createArticle } from '@/app/admin/actions'

export default function ArticleForm({ locale }: { locale: 'fa' | 'en' }) {
  return (
    <form action={createArticle} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="titleFa" placeholder="عنوان فارسی" className="input" required />
        <input name="titleEn" placeholder="Title (English)" className="input" required />
      </div>
      <input name="slug" placeholder="slug (اختیاری)" className="input" />
      <input name="img" placeholder="آدرس تصویر شاخص" className="input" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="descFa" placeholder="توضیح کوتاه فارسی" className="input" required />
        <input name="descEn" placeholder="Short description" className="input" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <input name="tagFa" placeholder="تگ فارسی" className="input" required />
        <input name="tagEn" placeholder="tag" className="input" required />
        <input name="dateFa" placeholder="تاریخ فا (۲۵ تیر ۱۴۰۵)" className="input" required />
        <input name="dateEn" placeholder="date (Jul 16, 2026)" className="input" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="readFa" placeholder="زمان مطالعه (۶ دقیقه)" className="input" required />
        <input name="readEn" placeholder="read time (6 min)" className="input" required />
      </div>
      <textarea name="contentFa" placeholder="متن فارسی مقاله (هر خط = یک پاراگراف)" rows={6} className="input resize-none" required />
      <textarea name="contentEn" placeholder="English content (each line = paragraph)" rows={6} className="input resize-none" required />
      <button type="submit" className="btn-primary w-fit">
        {locale === 'fa' ? 'انتشار مقاله' : 'Publish'}
      </button>
    </form>
  )
}
EOF

cat > src/app/admin/page.tsx << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()

  const [prompts, users, comments, likes] = await Promise.all([
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.comment.count(),
    prisma.like.count(),
  ])

  const recentPrompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })

  const stats = [
    { label: 'پرامپت‌ها', value: prompts },
    { label: 'کاربرها', value: users },
    { label: 'کامنت‌ها', value: comments },
    { label: 'لایک‌ها', value: likes },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">داشبورد</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-ink-muted">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-extrabold text-gold-bright">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gold-bright">آخرین پرامپت‌ها</h2>
          <ul className="mt-4 space-y-3">
            {recentPrompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{p.titleFa}</span>
                <span className="text-xs text-ink-faint">{p.likes} لایک</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gold-bright">آخرین کاربرها</h2>
          <ul className="mt-4 space-y-3">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                {u.image ? (
                  <img src={u.image} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold/20 text-xs text-gold-bright">؟</span>
                )}
                <span className="line-clamp-1">{u.name ?? u.email}</span>
                <span className="ms-auto text-xs text-ink-faint">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/prompts/page.tsx << 'EOF'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deletePrompt } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminPrompts() {
  await requireAdmin()
  const prompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'desc' }, include: { category: true } })

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
              <th className="p-4">دسته</th>
              <th className="p-4">مدل</th>
              <th className="p-4">لایک</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} className="border-b border-line/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img src={p.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="line-clamp-1">{p.titleFa}</span>
                  </div>
                </td>
                <td className="p-4 text-ink-muted">{p.category.nameFa}</td>
                <td className="p-4 text-ink-muted">{p.model}</td>
                <td className="p-4 text-ink-muted">{p.likes}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Link href={'/admin/prompts/' + p.id + '/edit'} className="btn-secondary px-3 py-1 text-xs">ویرایش</Link>
                    <form action={deletePrompt.bind(null, p.id)}>
                      <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/prompts/new/page.tsx << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import PromptForm from '@/components/admin/prompt-form'

export const dynamic = 'force-dynamic'

export default async function NewPrompt() {
  await requireAdmin()
  const categories = await prisma.category.findMany({ include: { subs: true } })
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">پرامپت جدید</h1>
      <div className="mt-6">
        <PromptForm categories={categories} locale="fa" />
      </div>
    </div>
  )
}
EOF

cat > 'src/app/admin/prompts/[id]/edit/page.tsx' << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { notFound } from 'next/navigation'
import PromptForm from '@/components/admin/prompt-form'

export const dynamic = 'force-dynamic'

export default async function EditPrompt({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const [prompt, categories] = await Promise.all([
    prisma.prompt.findUnique({ where: { id } }),
    prisma.category.findMany({ include: { subs: true } }),
  ])
  if (!prompt) notFound()

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">ویرایش: {prompt.titleFa}</h1>
      <div className="mt-6">
        <PromptForm categories={categories} initial={prompt} locale="fa" />
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/articles/page.tsx << 'EOF'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deleteArticle } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminArticles() {
  await requireAdmin()
  const articles = await prisma.article.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">مقالات</h1>
        <Link href="/admin/articles/new" className="btn-primary">+ مقاله جدید</Link>
      </div>

      <div className="mt-6 space-y-4">
        {articles.map((a) => (
          <div key={a.id} className="card flex items-center gap-4 p-4">
            <img src={a.img} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-bold">{a.titleFa}</p>
              <p className="mt-1 text-xs text-ink-faint">{a.tagFa} • {a.dateFa}</p>
            </div>
            <form action={deleteArticle.bind(null, a.id)}>
              <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/articles/new/page.tsx << 'EOF'
import { requireAdmin } from '@/lib/admin'
import ArticleForm from '@/components/admin/article-form'

export const dynamic = 'force-dynamic'

export default async function NewArticle() {
  await requireAdmin()
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">مقاله جدید</h1>
      <div className="mt-6">
        <ArticleForm locale="fa" />
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/categories/page.tsx << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { createCategory, deleteCategory } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminCategories() {
  await requireAdmin()
  const categories = await prisma.category.findMany({ include: { subs: true, _count: { select: { prompts: true } } }, orderBy: { order: 'asc' } })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">دسته‌بندی‌ها</h1>

      <form action={createCategory} className="card mt-6 grid max-w-2xl gap-4 p-6">
        <p className="text-sm font-bold text-gold-bright">دسته جدید</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="nameFa" placeholder="نام فارسی" className="input" required />
          <input name="nameEn" placeholder="Name (English)" className="input" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <select name="icon" className="input">
            <option value="camera">دوربین (تصویر)</option>
            <option value="play">پخش (ویدیو)</option>
            <option value="file">فایل (متن)</option>
            <option value="code">کد</option>
            <option value="music">موسیقی</option>
            <option value="gear">چرخ‌دنده (بهره‌وری)</option>
          </select>
          <input name="slug" placeholder="slug (اختیاری)" className="input" />
        </div>
        <input name="descFa" placeholder="توضیح فارسی" className="input" required />
        <input name="descEn" placeholder="Description" className="input" required />
        <textarea name="subs" placeholder={'زیردسته‌ها (هر خط: slug|فا|en)\nمثال: photography|عکاسی|Photography'} rows={4} className="input resize-none" />
        <button type="submit" className="btn-primary w-fit">افزودن دسته</button>
      </form>

      <div className="mt-8 space-y-4">
        {categories.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{c.nameFa} <span className="text-xs text-ink-faint">({c._count.prompts} پرامپت)</span></p>
              <form action={deleteCategory.bind(null, c.id)}>
                <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
              </form>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {c.subs.map((s) => (
                <span key={s.id} className="badge">{s.fa}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

cat > src/app/admin/comments/page.tsx << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deleteComment } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminComments() {
  await requireAdmin()
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, prompt: true, article: true },
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">کامنت‌ها</h1>

      <div className="mt-6 space-y-4">
        {comments.length === 0 && (
          <p className="card p-6 text-sm text-ink-muted">هنوز کامنتی ثبت نشده.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gold-bright">{c.user?.name ?? c.name}</p>
              <form action={deleteComment.bind(null, c.id)}>
                <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
              </form>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-muted">{c.text}</p>
            <p className="mt-2 text-[10px] text-ink-faint">
              روی: {c.prompt?.titleFa ?? c.article?.titleFa ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

cat > src/components/layout/header.tsx << 'EOF'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { dictionaries, type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import { LanguageToggle } from '@/components/locale-provider'
import CategoryIcon from '@/components/category-icon'

export default async function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]
  const session = await auth()
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-base/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/explore" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.explore}
            </Link>
            <Link href="/prompts" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.prompts}
            </Link>

            <div className="group relative">
              <Link href="/categories" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {t.nav.categories}
              </Link>

              <div className="absolute end-0 top-full z-50 hidden w-80 pt-3 group-hover:block">
                <div className="card grid grid-cols-2 gap-2 p-3">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={'/categories/' + c.slug}
                      className="rounded-xl border border-line bg-elevated p-3 transition-colors hover:border-gold/50 hover:bg-surface-hover"
                    >
                      <div className="text-gold-bright [&_svg]:h-5 [&_svg]:w-5">
                        <CategoryIcon name={c.icon} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-ink">
                        {L(locale, c.nameFa, c.nameEn)}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-ink-faint">
                        {c.subs.map((s) => L(locale, s.fa, s.en)).join('، ')}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/creators" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.creators}
            </Link>
            <Link href="/blog" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.blog}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session?.user?.role === 'ADMIN' && (
            <Link href="/admin" className="btn-secondary hidden md:inline-flex">
              {locale === 'fa' ? 'مدیریت' : 'Admin'}
            </Link>
          )}

          <Link href="/submit" className="btn-secondary hidden md:inline-flex">
            {t.submit}
          </Link>

          <LanguageToggle locale={locale} label={t.langToggle} />

          {session?.user ? (
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button type="submit" className="btn-secondary">{t.logout}</button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary">{t.login}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
EOF

echo "✅ Admin panel ready!"