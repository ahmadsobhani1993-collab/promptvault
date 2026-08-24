import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PromptsPage() {
  // Redirect to explore page safely instead of crashing
  redirect('/explore')
}
