import Link from 'next/link'
import { getImageUrl } from '@/lib/image-utils'
import type { Locale } from '@/lib/i18n'
import { getPromptTypeLabel } from '@/lib/data'
import { L } from '@/lib/l'
import SafeImg from '@/components/safe-img'

type PromptItem = {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: string
  tagsFa?: string[]
  tagsEn?: string[]
  likes?: number
  saves?: number
  views?: number
  stars?: number
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function PromptCard(props: {
  item?: PromptItem
  prompt?: PromptItem
  locale?: Locale
  cornerTags?: string[]
  isNew?: boolean
  hideStats?: boolean
}) {
  const item = props?.item || props?.prompt || ({} as PromptItem)
  const locale: Locale = props?.locale || 'fa'

  return (
    <article className="rounded-2xl border border-line/60 bg-[#14120e] p-3 transition-all hover:border-gold/40 hover:-translate-y-1 shadow-md">
      <Link href={'/prompts/' + (item.slug || '')} prefetch={false} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface/60">
          <SafeImg
            src={getImageUrl(item.img)}
            alt={L(locale, item.titleFa || '', item.titleEn || '')}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute right-2 top-2 rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] font-bold text-[#171512] shadow">
            {item.model || 'AI'}
          </span>
          {props.isNew && (
            <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              NEW
            </span>
          )}
        </div>

        <div className="mt-3">
          <h3 className="line-clamp-1 text-sm font-bold text-zinc-100 hover:text-gold-bright transition-colors">
            {L(locale, item.titleFa || 'بدون عنوان', item.titleEn || 'Untitled')}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-zinc-400">
            {Array.isArray(item.tagsFa) && item.tagsFa.length > 0
              ? item.tagsFa.slice(0, 3).join(' • ')
              : 'هوش مصنوعی'}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-zinc-400 font-mono">
          <span className="font-sans text-zinc-400">{getPromptTypeLabel(item.type, locale)}</span>
          {!props.hideStats && (
            <div className="flex items-center gap-2">
              <span>👁 {fmt(Number(item.views) || 0)}</span>
              <span>❤ {fmt(Number(item.likes) || 0)}</span>
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}