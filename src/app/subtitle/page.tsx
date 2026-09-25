import ToolAuthGuard from '@/components/tools/ToolAuthGuard'
import VideoSubtitleClient from '@/components/transcribe/VideoSubtitleClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'استودیو زیرنویس هوشمند ویدیو | PromptsFA',
  description: 'تولید خودکار زیرنویس هماهنگ و دقیق برای ویدیوها با مدل‌های هوش مصنوعی به‌صورت امن در مرورگر.',
}

export default function SubtitlePage() {
  return (
    <ToolAuthGuard
      toolName="استودیو زیرنویس"
      description="برای استفاده از استودیو زیرنویس هوشمند و تبدیل گفتار ویدیو به متن، لطفاً وارد حساب خود شوید."
    >
      <main className="container-app min-h-[85vh] py-10">
        <VideoSubtitleClient />
      </main>
    </ToolAuthGuard>
  )
}
