import Link from 'next/link'
import { getRequestLocale } from '@/lib/request-locale'
import { L } from '@/lib/l'
import { localizedPath } from '@/lib/locale-path'

export default async function ToolsPage() {
  const locale = await getRequestLocale()
  const tools = [
    { href: '/transcribe', label: L(locale, 'تبدیل صوت به متن', 'Audio to text'), desc: L(locale, 'تبدیل فایل صوتی به متن', 'Transcribe audio files into text') },
    { href: '/subtitle', label: L(locale, 'استودیو زیرنویس', 'Subtitle studio'), desc: L(locale, 'زیرنویس خودکار ویدیو و ریلز', 'Create captions for videos and reels') },
    { href: '/audio-enhancer', label: L(locale, 'تقویت و شفاف‌ساز صدا', 'Audio enhancer'), desc: L(locale, 'کاهش نویز و شفاف‌سازی با AI', 'Reduce noise and enhance speech with AI') },
    { href: '/tools/bg-remover', label: L(locale, 'حذف پس‌زمینه', 'Background remover'), desc: L(locale, 'حذف خودکار پس‌زمینه تصویر', 'Automatically remove image backgrounds') },
    { href: '/pdf-to-word', label: L(locale, 'تبدیل PDF به ورد', 'PDF to Word'), desc: L(locale, 'استخراج متن و تصویر با OCR', 'Extract text and images with OCR') },
  ]

  return (
    <section className="container-app py-10">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-gold-bright mb-6">{L(locale, 'ابزارها', 'Tools')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={localizedPath(locale, tool.href)}
              className="rounded-2xl border border-gold/20 bg-gradient-to-br from-surface to-elevated p-6 transition-all hover:-translate-y-1 hover:border-gold/50 hover:shadow-lg"
            >
              <div className="text-lg font-bold text-ink mb-2">{tool.label}</div>
              <div className="text-xs text-ink-muted">{tool.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
