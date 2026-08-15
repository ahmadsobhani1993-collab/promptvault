import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, getPromptTypeLabel } from '@/lib/data'
import SafeImg from '@/components/safe-img'

type PromptItem = {
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

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function PromptCard({
  item,
  locale,
  cornerTags,
  isNew,
}: {
  item: PromptItem
  locale: Locale
  cornerTags?: string[]
  isNew?: boolean
}) {
  const dead = item.likes + item.saves + item.views === 0
  return (
    <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
      <Link href={'/prompts/' + item.slug} className="block">
        <div className="relative">
          <SafeImg src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="aspect-square w-full rounded-lg object-cover" />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {getPromptTypeLabel(item.type, locale)}
          </span>
          {isNew && (
            <span className="absolute left-2 top-2 rounded-full bg-success px-2.5 py-0.5 text-[9px] font-bold text-[#0d1a10]">
              ✨ {L(locale, 'جدید', 'New')}
            </span>
          )}
          {cornerTags && cornerTags.length > 0 && (
            <span className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
              {cornerTags.map((t) => (
                <span key={t} className="rounded-full bg-[#171512]/85 px-2 py-0.5 text-[9px] text-gold-bright">
                  {t}
                </span>
              ))}
            </span>
          )}
          <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
            {item.model}
          </span>
        </div>
        <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
          {L(locale, item.titleFa, item.titleEn)}
        </h3>
      </Link>

      <div className="mt-2 flex flex-wrap gap-1">
        {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
          <Link
            key={tag}
            href={'/explore?tags=' + encodeURIComponent(tag)}
            className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443] transition-colors hover:bg-gold hover:text-[#171512]"
          >
            {tag}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
        {dead ? (
          <span className="text-[#8a8172]">{L(locale, 'منتظر اولین تعامل ✨', 'Awaiting first interaction ✨')}</span>
        ) : (
          <>
            <span>{fmt(item.likes)} {L(locale, 'پسند', 'likes')}</span>
            <span>{fmt(item.saves)} {L(locale, 'ذخیره', 'saves')}</span>
            <span>{fmt(item.views)} {L(locale, 'بازدید', 'views')}</span>
          </>
        )}
      </div>
    </article>
  )
}
