import ToolAuthGuard from '@/components/tools/ToolAuthGuard'
import type { Metadata } from 'next'
import AudioEnhancerStudio from '@/components/audio-enhancer/AudioEnhancerStudio'
import { getRequestLocale } from '@/lib/request-locale'

export async function generateMetadata(): Promise<Metadata> {
  const isEn = (await getRequestLocale()) === 'en'
  return {
    title: isEn ? 'AI Audio Enhancer | PromptsFA' : 'تقویت و شفاف‌ساز صدا با هوش مصنوعی | PromptsFA',
    description: isEn
      ? 'Reduce background noise, improve speech clarity, and enhance audio and video files locally in your browser.'
      : 'حذف نویز محیطی، افزایش وضوح گفتار، تغییر تن و شفاف‌سازی حرفه‌ای فایل‌های صوتی و ویدیویی به صورت ۱۰۰٪ امن در مرورگر کاربر.',
    alternates: { canonical: 'https://promptsfa.ir/audio-enhancer' },
  }
}

export default async function AudioEnhancerPage() {
  const isEn = (await getRequestLocale()) === 'en'
  return (
    <ToolAuthGuard
      toolName={isEn ? 'Audio Enhancer Studio' : 'استودیو تقویت و شفاف‌ساز صدا'}
      description={isEn
        ? 'Sign in to use AI audio processing and enhancement in your browser.'
        : 'برای استفاده از پردازش هوش مصنوعی و شفاف‌سازی صدا در مرورگر، لطفاً ابتدا وارد حساب کاربری خود شوید.'}
    >
      <main className="container-app min-h-[85vh] py-10">
        <AudioEnhancerStudio />
      </main>
    </ToolAuthGuard>
  )
}
