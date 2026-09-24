import ToolAuthGuard from '@/components/tools/ToolAuthGuard'
import type { Metadata } from 'next'
import AudioEnhancerStudio from '@/components/audio-enhancer/AudioEnhancerStudio'

export const metadata: Metadata = {
  title: 'تقویت و شفاف‌ساز صدا با هوش مصنوعی | PromptsFA',
  description: 'حذف نویز محیطی، افزایش وضوح گفتار، تغییر تن و شفاف‌سازی حرفه‌ای فایل‌های صوتی و ویدیویی به صورت ۱۰۰٪ امن در مرورگر کاربر.',
  alternates: {
    canonical: 'https://promptsfa.ir/audio-enhancer',
  },
}

export default function AudioEnhancerPage() {
  return (
    <main className="container-app min-h-[85vh] py-10">
      <AudioEnhancerStudio />
    </main>
  )
}
