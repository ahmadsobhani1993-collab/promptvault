import PromptDetailPage from '@/app/prompts/[slug]/page'

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

export { generateMetadata } from '@/app/prompts/[slug]/page'

export default function EnPromptDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PromptDetailPage params={params} forcedLocale="en" />
}