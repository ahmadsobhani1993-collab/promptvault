import Link from 'next/link'
import type { Locale } from '@/lib/i18n'

export default function Hero({
  locale,
  label,
  title,
  subtitle,
  placeholder,
  chips,
}: {
  locale: Locale
  label: string
  title: string
  subtitle: string
  placeholder: string
  chips: { fa: string; en: string; href: string }[]
}) {
  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="fx-blob anim-float" style={{ top: '-10%', right: '-10%', width: '40vw', height: '40vw' }} />
        <div className="fx-blob anim-float2" style={{ bottom: '-15%', left: '-10%', width: '36vw', height: '36vw' }} />
      </div>

      <div className="container-app relative text-center">
        <p className="gold-badge mx-auto w-fit anim-fade-up">{label}</p>
        <h1 className="hero-title anim-fade-up mx-auto mt-6 max-w-none font-display text-4xl font-black leading-tight md:text-6xl" style={{ animationDelay: '120ms' }}>
          {title}
        </h1>
        

        <form action="/explore" className="anim-fade-up mx-auto mt-10 max-w-2xl" style={{ animationDelay: '360ms' }}>
          <div className="glow-gold flex items-center gap-3 rounded-2xl border border-gold/40 bg-elevated px-5 py-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-gold-bright">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              placeholder={placeholder}
              className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
            />
            <button type="submit" className="btn-primary shrink-0">
              {locale === 'fa' ? 'جستجو' : 'Search'}
            </button>
          </div>
        </form>

        <div className="anim-fade-up mt-6 flex flex-wrap justify-center gap-2" style={{ animationDelay: '480ms' }}>
          {chips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-full border border-line bg-elevated px-4 py-1.5 text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
            >
              {locale === 'fa' ? c.fa : c.en}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
