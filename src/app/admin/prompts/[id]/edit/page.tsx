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
