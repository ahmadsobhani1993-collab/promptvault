New-Item -ItemType Directory -Force -Path "src/app/audio-enhancer"
New-Item -ItemType Directory -Force -Path "src/components/audio-enhancer"

@'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'تقویت و شفاف‌ساز صدا با هوش مصنوعی | PromptsFA',
  description: 'حذف نویز محیطی، افزایش وضوح گفتار و شفاف‌سازی حرفه‌ای فایل‌های صوتی و ویدیویی به صورت ۱۰۰٪ امن و محلی در مرورگر کاربر.',
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
    <main className="container-app min-h-[80vh] py-10">
      <AudioEnhancerStudio />
    </main>
  )
}
'@ | Set-Content -Path "src/app/audio-enhancer/page.tsx" -Encoding UTF8

Write-Host "AUDIO_ENHANCER_ROUTE_CREATED"
