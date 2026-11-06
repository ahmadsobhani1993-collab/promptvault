import PromptDetailPage from '@/app/prompts/[slug]/page'
import { generatePromptMetadata } from '@/lib/prompt-seo'

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return generatePromptMetadata(params, 'en')
}

export default function EnPromptDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PromptDetailPage params={params} />
}