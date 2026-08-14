'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'

type Chip = { fa: string; en: string; href: string }

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
  chips: Chip[]
}) {
  const [focused, setFocused] = useState(false)

  return (
    <section
      data-section
      className="hero-radial snap-section relative flex min-h-[92vh] items-center overflow-hidden border-b border-line/60"
    >
      <div
        className={
          'absolute inset-0 transition-opacity duration-700 ' +
          (focused ? 'opacity-40' : 'opacity-20')
        }
      >
        <img
          src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop"
          alt=""
          className="animate-kenburns h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-base/60 via-base/30 to-base" />
      </div>

      <div className="container-app relative py-16 text-center">
        <p
          className={
            'text-xs font-semibold uppercase text-gold-bright ' +
            (locale === 'fa' ? '' : 'tracking-[0.35em]')
          }
        >
          {label}
        </p>

        <h1 className="title-solid mt-5 font-display text-4xl font-extrabold tracking-tight md:text-6xl">
          {title}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-ink-muted md:text-base">
          {subtitle}
        </p>

        <form action="/explore" className="mx-auto mt-9 max-w-2xl">
          <input
            name="q"
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="glow-gold h-14 w-full rounded-full border border-gold/60 bg-[#F7F1E3] px-6 text-base text-[#171512] placeholder:text-[#8a8271] focus:outline-none"
          />
        </form>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="glow-soft rounded-full border border-gold/70 bg-[#141008] px-4 py-1.5 text-xs text-[#F2EAD8] transition-colors hover:bg-[#1d1608]"
            >
              {c[locale]}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
