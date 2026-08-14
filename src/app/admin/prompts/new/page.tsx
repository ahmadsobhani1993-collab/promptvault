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
