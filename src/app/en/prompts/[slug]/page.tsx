import PromptDetailPage from '@/app/prompts/[slug]/page'

export default async function EnPromptPage({ params }: { params: any }) {
  return <PromptDetailPage params={params} forcedLocale="en" />
}
export { generateMetadata } from '@/app/prompts/[slug]/page'
