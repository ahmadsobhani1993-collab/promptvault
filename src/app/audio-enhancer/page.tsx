import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'تقویت و شفاف‌ساز صدا با هوش مصنوعی | PromptsFA',
  description: 'حذف نویز محیطی، افزایش وضوح گفتار، تغییر تن و شفاف‌سازی حرفه‌ای فایل‌های صوتی و ویدیویی به صورت ۱۰۰٪ امن در مرورگر کاربر.',
  alternates: {
    canonical: 'https://promptsfa.ir/audio-enhancer',
  },
}

const AudioEnhancerStudio = dynamic(
  () => import('@/components/audio-enhancer/AudioEnhancerStudio'),
  { ssr: false }
)

export default function AudioEnhancerPage() {
  return (
    <main className="container-app min-h-[85vh] py-10">
      <AudioEnhancerStudio />
    </main>
  )
}
