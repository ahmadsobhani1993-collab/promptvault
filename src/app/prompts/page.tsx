import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = { title: 'پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function PromptsPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const prompts = await getPrompts()

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'همه پرامپت‌ها', 'All Prompts')}
      </h1>
      <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {prompts.map((item) => (
          <PromptCard key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </section>
  )
}
