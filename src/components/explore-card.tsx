import Link from 'next/link'
import SafeImg from '@/components/safe-img'
import { getImageUrl } from '@/lib/image-utils'
import type { Locale } from '@/lib/i18n'
import { L } from '@/lib/data'

type P = {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: string
  tagsFa: string[]
  tagsEn: string[]
  likes: number
  saves: number
  views: number
  stars: number
}

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n))

export default function ExploreCard({ item, locale, bookmark }: { item: P; locale: Locale; bookmark: React.ReactNode }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-elevated transition-all hover:border-gold/40 hover:shadow-gold-glow">
      <Link href={'/prompts/' + item.slug} className="relative block aspect-square overflow-hidden">
        <SafeImg
          src={getImageUrl(item.img)}
          alt={L(locale, item.titleFa, item.titleEn)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-full border border-line/60 bg-[#0b0b0b]/80 px-2 py-0.5 text-[10px] font-semibold text-gold-bright backdrop-blur">
          ★ {(item.stars || 0).toFixed(1)}
        </span>
        <div className="absolute right-2 top-2">{bookmark}</div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={'/prompts/' + item.slug}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-gold-bright">
            {L(locale, item.titleFa, item.titleEn)}
          </h3>
        </Link>
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">{item.model}</span>
      </div>

      <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[10px] text-ink-muted">
        <span title="بازدید">👤 {fmt(item.views)}</span>
        <span title="پسند">♡ {fmt(item.likes)}</span>
        <span title="ذخیره">⌂ {fmt(item.saves)}</span>
      </div>
    </article>
  )
}
