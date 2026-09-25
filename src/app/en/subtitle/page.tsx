import ToolAuthGuard from '@/components/tools/ToolAuthGuard'
import VideoSubtitleClient from '@/components/transcribe/VideoSubtitleClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Video Subtitle Studio | PromptsFA',
  description: 'Generate accurate, synchronized subtitles for your videos directly in browser.',
}

export default function SubtitlePageEn() {
  return (
    <ToolAuthGuard
      toolName="Subtitle Studio"
      description="Please sign in to access AI Video Subtitle Studio."
    >
      <main className="container-app min-h-[85vh] py-10">
        <VideoSubtitleClient />
      </main>
    </ToolAuthGuard>
  )
}
