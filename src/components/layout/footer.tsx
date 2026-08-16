import Link from 'next/link'
import PWAControls from '@/components/pwa-controls'

export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-[#0a0805]">
      <div className="container-app grid gap-10 py-14 md:grid-cols-2">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </p>
          <p className="mt-3 text-sm leading-7 text-ink-muted">
            ما را در شبکه‌های اجتماعی دنبال کنید:
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="https://t.me/prompts_fa" target="_blank" rel="noreferrer" className="btn-secondary">
              📣 تلگرام: @prompts_fa
            </a>
            <a href="https://instagram.com/prompts_fa" target="_blank" rel="noreferrer" className="btn-secondary">
              📸 اینستاگرام: @prompts_fa
            </a>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-gold-bright">همکار ما</p>
          <a
            href="https://finsoph.ir"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-bold text-ink-muted transition-colors hover:text-gold-bright"
          >
            فینسوف | Finsoph
          </a>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            وب‌سایت دوست و همکار ما؛ مرجع آموزش و ابزارهای هوش مصنوعی.
          </p>
          <a
            className="mt-3 inline-block text-xs text-gold-bright hover:text-gold"
            href="https://finsoph.ir"
            target="_blank"
            rel="noreferrer"
          >
            مشاهده وب‌سایت ←
          </a>
        </div>
      </div>

      <div className="container-app flex flex-wrap items-center justify-center gap-4 border-t border-line/50 py-5">
        <PWAControls />
        <p className="text-[11px] text-ink-faint">
        © {new Date().getFullYear()} PromptsFA — همه حقوق محفوظ است.</p>
      </div>
    </footer>
  )
}
