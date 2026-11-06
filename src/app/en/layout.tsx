import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'PromptsFA | AI Prompts',
    template: '%s | PromptsFA',
  },
  description:
    'Discover professional AI prompts for images, video, text, code, music, and productivity.',
}

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return children
}
