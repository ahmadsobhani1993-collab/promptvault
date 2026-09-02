'use client'
import { useEffect, useRef, useState } from 'react'
import FilterSidebar from './FilterSidebar'
import ExploreCard from '../explore-card'
import SaveButton from '../save-button'
import type { Locale } from '@/lib/i18n'

type P = any
type Active = { type?: string; sub?: string; model?: string; tags: string[]; sort: string; q: string }

export default function ExploreClient({
  initial,
  initialTotal,
  filters,
  locale,
  basePath,
  initialActive,
}: {
  initial: P[]
  initialTotal: number
  filters: { subs: any[]; models: string[]; tags: { tag: string; count: number }[] }
  locale: Locale
  basePath: string
  initialActive: Active
}) {
  const [rows, setRows] = useState<P[]>(initial)
  const [active, setActive] = useState<Active>(initialActive)
  const [page, setPage] = useState(1)
  const [done, setDone] = useState(initial.length >= initialTotal)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState(initialActive.q)
  const sentinel = useRef<HTMLDivElement>(null)
  const firstLoad = useRef(true)

  const qs = (pg: number, a: Active) => {
    const sp = new URLSearchParams()
    if (a.q) sp.set('q', a.q)
    if (a.type) sp.set('type', a.type)
    if (a.sub) sp.set('sub', a.sub)
    if (a.model) sp.set('model', a.model)
    if (a.tags.length) sp.set('tags', a.tags.join(','))
    if (a.sort && a.sort !== 'newest') sp.set('sort', a.sort)
    sp.set('page', String(pg))
    return sp.toString()
  }

  // وقتی فیلتر عوض شد → reset و fetch page 1
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    setPage(1)
    setDone(false)
    setLoading(true)
    const url = basePath + '/api/explore?' + qs(1, active)
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows ?? [])
        setDone((j.rows?.length ?? 0) === 0 || 1 >= (j.pages ?? 1))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [active])

  // load more روی اسکرول
  useEffect(() => {
    const el = sentinel.current
    if (!el || done || loading) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        setLoading(true)
        fetch(basePath + '/api/explore?' + qs(page + 1, active))
          .then((r) => r.json())
          .then((j) => {
            if (!j.rows?.length) setDone(true)
            else {
              setRows((r) => r.concat(j.rows))
              setPage((p) => p + 1)
              if (page + 1 >= (j.pages ?? 1)) setDone(true)
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      },
      { rootMargin: '800px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [page, done, loading, active])

  const onSelect = (k: string, v: string) => setActive((a) => ({ ...a, [k]: v }))
  const onToggleTag = (t: string) =>
    setActive((a) => ({
      ...a,
      tags: a.tags.includes(t) ? a.tags.filter((x) => x !== t) : [...a.tags, t],
    }))
  const onReset = () => {
    setActive({ type: '', sub: '', model: '', tags: [], sort: 'newest', q: '' })
    setQ('')
  }

  let qTimer: any = null
  const onQ = (v: string) => {
    setQ(v)
    clearTimeout(qTimer)
    qTimer = setTimeout(() => setActive((a) => ({ ...a, q: v })), 350)
  }

  return (
    <section className="container-app py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterSidebar
          locale={locale}
          subs={filters.subs}
          models={filters.models}
          tags={filters.tags}
          active={active}
          onToggleTag={onToggleTag}
          onSelect={onSelect}
          onReset={onReset}
        />

        <main className="min-w-0 flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setActive((a) => ({ ...a, q }))
            }}
            className="mb-6 flex gap-2"
          >
            <input
              value={q}
              onChange={(e) => onQ(e.target.value)}
              placeholder="جستجو در پرامپت‌ها..."
              className="input flex-1 text-base"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">جستجو</button>
          </form>

          {rows.length === 0 && !loading && (
            <div className="rounded-xl border border-line bg-elevated p-12 text-center text-sm text-ink-muted">
              هیچ پرامپتی با این فیلترها یافت نشد.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((p, i) => (
              <ExploreCard
                key={p.id + '-' + i}
                item={p}
                locale={locale}
                bookmark={<SaveButton promptId={p.id} />}
              />
            ))}
          </div>

          <div ref={sentinel} className="flex h-20 items-center justify-center">
            {loading && <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />}
            {done && rows.length > 0 && <p className="text-xs text-ink-faint">— پایان —</p>}
          </div>
        </main>
      </div>
    </section>
  )
}
