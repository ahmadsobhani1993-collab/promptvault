import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { notFound } from 'next/navigation'
import PromptForm from '@/components/admin/prompt-form'

export const dynamic = 'force-dynamic'

export default async function EditPrompt({ params }: { params: Promise<{ slug?: string; id?: string }> }) {
  await requireAdmin()
  const resolvedParams = await params
  const identifier = resolvedParams.slug || resolvedParams.id

  if (!identifier) notFound()

  const [prompt, categories] = await Promise.all([
    prisma.prompt.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ]
      }
    }),
    prisma.category.findMany({ include: { subs: true } }),
  ])

  if (!prompt) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-extrabold text-ink mb-6">ویرایش پرامپت: {prompt.titleFa}</h1>
      <div className="mt-4">
        <PromptForm categories={categories} initial={prompt} locale="fa" />
      </div>
    </div>
  )
}
