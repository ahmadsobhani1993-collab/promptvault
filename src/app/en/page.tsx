import HomePage from '@/app/page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Discover professional AI prompts',
  description:
    'Discover professional AI prompts for images, video, text, code, music, and productivity.',
  alternates: {
    canonical: 'https://promptsfa.ir/en',
    languages: {
      'fa-IR': 'https://promptsfa.ir',
      'en-US': 'https://promptsfa.ir/en',
    },
  },
  openGraph: {
    title: 'PromptsFA | Discover professional AI prompts',
    description:
      'Discover professional AI prompts for images, video, text, code, music, and productivity.',
    locale: 'en_US',
    url: 'https://promptsfa.ir/en',
    siteName: 'PromptsFA',
    type: 'website',
  },
}

export const dynamic = 'force-dynamic'

export default function EnglishHomePage() {
  return <HomePage />
}
