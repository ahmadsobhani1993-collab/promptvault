#!/bin/bash
set -e

mkdir -p src/app/admin/users

# faster sync: 10 pages per tick
sed -i 's/for (let i = 0; i < 3; i++)/for (let i = 0; i < 10; i++)/' src/app/api/cron/telegram/route.ts

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
  const titleEn = (fd.get('titleEn') as string) || titleFa

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
      usageFa: (fd.get('usageFa') as string) || null,
      usageEn: (fd.get('usageEn') as string) || null,
      status: 'PENDING',
      userId: session.user.id,
    },
  })

  revalidatePath('/', 'layout')
  redirect('/submit?done=1')
}
EOF

cat > src/app/submit/page.tsx << 'EOF'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { type Locale } from '@/lib/i18n'
import { L } from '@/lib/data'
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

        <textarea
          name="usageFa"
          placeholder={L(
            locale,
            'راهنمای استفاده (فارسی): مثلا در کدام مدل بگذارم، چه پارامترهایی بزنم، نکات مهم...',
            'How to use (Persian)...'
          )}
          rows={3}
          className="input resize-none"
        />

        <textarea
          name="usageEn"
          placeholder="How to use (English): which model, parameters, tips..."
          rows={3}
          className="input resize-none"
          dir="ltr"
        />

        <button type="submit" className="btn-primary w-fit">
          {L(locale, 'ارسال برای بررسی', 'Submit for review')}
        </button>
      </form>
    </section>
  )
}
EOF

cat > src/app/admin/user-actions.ts << 'EOF'
'use server'

import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function promoteUser(id: string) {
  await requireAdmin()
  await prisma.user.update({ where: { id }, data: { role: 'ADMIN' } })
  revalidatePath('/admin', 'layout')
}

export async function demoteUser(id: string) {
  const session = await requireAdmin()
  if (session.user.id === id) return
  await prisma.user.update({ where: { id }, data: { role: 'USER' } })
  revalidatePath('/admin', 'layout')
}
EOF

cat > src/app/admin/users/page.tsx << 'EOF'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { promoteUser, demoteUser } from '@/app/admin/user-actions'

export const dynamic = 'force-dynamic'

export default async function AdminUsers() {
  const session = await requireAdmin()
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">کاربرها و ادمین‌ها</h1>
      <p className="mt-2 text-xs text-ink-muted">
        با دکمه‌ها نقش کاربر را عوض کن. (خودت را نمی‌توانی از ادمینی حذف کنی.)
      </p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-ink-muted">
              <th className="p-4">کاربر</th>
              <th className="p-4">نقش</th>
              <th className="p-4">تاریخ عضویت</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      <img src={u.image} alt="" className="h-9 w-9 rounded-full" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-xs text-gold-bright">؟</span>
                    )}
                    <div>
                      <p className="line-clamp-1 font-bold">{u.name ?? '—'}</p>
                      <p className="text-[10px] text-ink-faint">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={'rounded-full border px-2 py-0.5 text-[10px] ' + (u.role === 'ADMIN' ? 'border-gold/40 bg-gold/10 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}>
                    {u.role === 'ADMIN' ? 'ادمین' : 'کاربر'}
                  </span>
                </td>
                <td className="p-4 text-xs text-ink-muted">
                  {new Date(u.createdAt).toLocaleDateString('fa-IR')}
                </td>
                <td className="p-4">
                  {u.id !== session.user.id && (
                    <form action={u.role === 'ADMIN' ? demoteUser.bind(null, u.id) : promoteUser.bind(null, u.id)}>
                      <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                        {u.role === 'ADMIN' ? 'حذف ادمین' : 'کردن به ادمین'}
                      </button>
                    </form>
                  )}
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
  { href: '/admin/users', fa: 'کاربرها و ادمین‌ها', en: 'Users & Admins' },
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

echo "✅ Usage fields + admin user management + faster sync!"