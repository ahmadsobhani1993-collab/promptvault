import Link from 'next/link'

export default function ToolsPage() {
  const tools = [
    { href: '/transcribe', label: 'تبدیل صوت به متن', desc: 'تبدیل فایل صوتی به متن' },
    { href: '/subtitle', label: 'استودیو زیرنویس', desc: 'زیرنویس خودکار ویدیو و ریلز' },
    { href: '/audio-enhancer', label: 'تقویت و شفاف‌ساز صدا', desc: 'کاهش نویز و شفاف‌سازی با AI' },
    { href: '/tools/bg-remover', label: 'حذف پس‌زمینه', desc: 'حذف خودکار پس‌زمینه تصویر' },
    { href: '/pdf-to-word', label: 'تبدیل PDF به ورد', desc: 'استخراج متن و تصویر با OCR' },
  ]

  return (
    <section className="container-app py-10">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-gold-bright mb-6">ابزارها</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
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
