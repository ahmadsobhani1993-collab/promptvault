import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, typeLabel, type Prompt } from '@/lib/data'

export default function PromptCard({
  item,
  locale,
}: {
  item: Prompt
  locale: Locale
}) {
  return (
    <Link href={'/prompts/' + item.slug} className="block">
      <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
        <div className="relative">
          <img
            src={item.img}
            alt={L(locale, item.titleFa, item.titleEn)}
            loading="lazy"
            className="aspect-square w-full rounded-lg object-cover"
          />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {L(locale, typeLabel[item.type].fa, typeLabel[item.type].en)}
          </span>
          <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
            {item.model}
          </span>
        </div>

        <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
          {L(locale, item.titleFa, item.titleEn)}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1">
          {item.tagsFa
            .map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag))
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]"
              >
                {tag}
              </span>
            ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
          <span>{item.likes} {L(locale, 'پسند', 'likes')}</span>
          <span>{item.saves} {L(locale, 'ذخیره', 'saves')}</span>
          <span>{item.views} {L(locale, 'بازدید', 'views')}</span>
        </div>
      </article>
    </Link>
  )
}
