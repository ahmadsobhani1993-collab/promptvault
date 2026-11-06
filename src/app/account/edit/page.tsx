import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import { getRequestLocale } from '@/lib/request-locale'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ویرایش پروفایل | PromptsFA' }

export default async function EditProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const locale: Locale = await getRequestLocale()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  return (
    <section className="container-app py-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-center">
          {L(locale, 'ویرایش پروفایل', 'Edit Profile')}
        </h1>
        
        <form
          action={async (formData) => {
            'use server'
            const name = formData.get('name') as string
            if (name && name.trim()) {
              await prisma.user.update({
                where: { id: userId },
                data: { name: name.trim() },
              })
            }
            redirect('/account')
          }}
          className="card mt-6 space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              {L(locale, 'نام', 'Name')}
            </label>
            <input
              name="name"
              type="text"
              defaultValue={user?.name || ''}
              placeholder={L(locale, 'نام شما', 'Your name')}
              className="input text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              {L(locale, 'ایمیل', 'Email')}
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input text-sm opacity-50"
            />
            <p className="mt-1 text-[10px] text-ink-faint">
              {L(locale, 'ایمیل قابل تغییر نیست', 'Email cannot be changed')}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {L(locale, 'ذخیره تغییرات', 'Save Changes')}
            </button>
            <a href="/account" className="btn-secondary flex-1 text-center">
              {L(locale, 'انصراف', 'Cancel')}
            </a>
          </div>
        </form>
      </div>
    </section>
  )
}
