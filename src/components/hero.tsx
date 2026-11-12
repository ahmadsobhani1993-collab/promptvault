import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { localizedPath } from '@/lib/locale-path'
import HeroSearchPlaceholder from '@/components/hero-search-placeholder'

export default function Hero({
  locale,
  label,
  title,
  placeholder,
  chips,
}: {
  locale: Locale
  label: string
  title: string
  placeholder: string
  chips: { fa: string; en: string; href: string }[]
}) {
  return (
    <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden px-4 py-20 md:min-h-[85vh] md:py-24">
      <div className="container-app relative z-10 text-center">
        <p className="mx-auto w-fit rounded-full border border-amber-300/30 bg-black/40 px-4 py-2 text-xs font-medium text-[#f3e5ab] shadow-[0_0_28px_rgba(212,175,55,0.1)] backdrop-blur-md anim-fade-up">{label}</p>
        <h1 className="title-solid anim-fade-up mx-auto mt-6 max-w-4xl font-display text-3xl font-extrabold leading-[1.65] tracking-tight sm:text-5xl md:text-6xl" style={{ animationDelay: '120ms' }}>
          {title}
        </h1>
        <form action={localizedPath(locale, '/explore')} className="anim-fade-up mx-auto mt-8 w-full max-w-2xl" style={{ animationDelay: '240ms' }}>
          <div className="relative flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-white/[0.045] p-2 shadow-[0_0_36px_rgba(212,175,55,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition focus-within:border-amber-200/70 focus-within:shadow-[0_0_42px_rgba(212,175,55,0.2)] sm:rounded-full sm:p-2.5">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="ms-2 h-5 w-5 shrink-0 text-[#f3d982]">
              <circle cx="11" cy="11" r="7.5" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <HeroSearchPlaceholder
              locale={locale}
              fallback={placeholder}
              ariaLabel={locale === 'fa' ? 'جستجوی پرامپت' : 'Search prompts'}
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-400 sm:text-base"
            />
            <button type="submit" className="shrink-0 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C59B27] px-5 py-3 text-sm font-bold text-black shadow-[0_4px_20px_rgba(212,175,55,0.2)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 sm:rounded-full sm:px-7">
              {locale === 'fa' ? 'جستجو' : 'Search'}
            </button>
          </div>
        </form>

        <div className="hero-category-scroll anim-fade-up mt-6 flex snap-x snap-mandatory justify-start gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible" style={{ animationDelay: '360ms' }}>
          {chips.map((c) => (
            <Link
              key={c.href}
              href={localizedPath(locale, c.href)}
              className="shrink-0 snap-start rounded-full border border-amber-400/20 bg-white/[0.035] px-3 py-1.5 text-xs text-stone-200 transition-all hover:border-amber-400/60 hover:bg-amber-400/10 sm:px-4"
            >
              {locale === 'fa' ? c.fa : c.en}
            </Link>
          ))}
        </div>
      </div>
      <a href="#trending" aria-label={locale === 'fa' ? 'رفتن به پرامپت‌های داغ' : 'Scroll to trending prompts'} className="hero-scroll-cue absolute bottom-5 left-1/2 z-10 grid h-10 w-10 -translate-x-1/2 place-items-center text-[#f3e5ab]/75 transition hover:text-[#f3e5ab]">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}
