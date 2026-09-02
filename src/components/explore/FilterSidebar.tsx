'use client'
import { L } from '@/lib/data'
import type { Locale } from '@/lib/i18n'

type Props = {
  locale: Locale
  subs: { slug: string; fa: string; en: string }[]
  models: string[]
  tags: { tag: string; count: number }[]
  active: {
    type?: string
    sub?: string
    model?: string
    tags: string[]
    sort: string
    q: string
  }
  onToggleTag: (t: string) => void
  onSelect: (k: string, v: string) => void
  onReset: () => void
}

const group = 'border-b border-line/60 py-4'
const label = 'mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint'
const chip = (active: boolean) =>
  'rounded-full border px-3 py-1 text-xs transition-all ' +
  (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line/60 text-ink-muted hover:border-gold/40 hover:text-ink')

export default function FilterSidebar(p: Props) {
  return (
    <aside className="w-full lg:w-72 lg:shrink-0">
      <div className="sticky top-20 space-y-1 rounded-xl border border-line bg-[#0f0f12] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">فیلترها</h2>
          <button onClick={p.onReset} className="text-[10px] text-ink-faint transition hover:text-gold-bright">
            پاک کردن همه
          </button>
        </div>

        <div className={group}>
          <div className={label}>مرتب‌سازی</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['newest', 'جدید'],
              ['likes', 'محبوب'],
              ['views', 'پربازدید'],
            ].map(([v, l]) => (
              <button key={v} onClick={() => p.onSelect('sort', v)} className={chip(p.active.sort === v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {p.subs.length > 0 && (
          <div className={group}>
            <div className={label}>نوع تصویر</div>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {p.subs.map((s) => (
                <label key={s.slug} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-muted transition hover:bg-white/5 hover:text-ink">
                  <input
                    type="checkbox"
                    checked={p.active.sub === s.slug}
                    onChange={() => p.onSelect('sub', p.active.sub === s.slug ? '' : s.slug)}
                    className="accent-gold"
                  />
                  {L(p.locale, s.fa, s.en)}
                </label>
              ))}
            </div>
          </div>
        )}

        {p.tags.length > 0 && (
          <div className={group}>
            <div className={label}>برچسب‌ها</div>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.slice(0, 30).map((t) => (
                <button
                  key={t.tag}
                  onClick={() => p.onToggleTag(t.tag)}
                  className={chip(p.active.tags.includes(t.tag))}
                >
                  {t.tag}
                  <span className="ml-1 text-[9px] text-ink-faint">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {p.models.length > 0 && (
          <div className={group}>
            <div className={label}>مدل AI</div>
            <div className="space-y-1">
              {p.models.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-muted transition hover:bg-white/5 hover:text-ink">
                  <input
                    type="checkbox"
                    checked={p.active.model === m}
                    onChange={() => p.onSelect('model', p.active.model === m ? '' : m)}
                    className="accent-gold"
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
