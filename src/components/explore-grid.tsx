'use client'

import { useEffect, useRef, useState } from 'react'
import PromptCard from '@/components/prompt-card'

type P = any

export default function ExploreGrid({ initial, qs, locale }: { initial: P[]; qs: (o: Record<string, string>) => string; locale: string }) {
  const [rows, setRows] = useState<P[]>(initial)
  const [page, setPage] = useState(1)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const initialRef = useRef(initial)

  useEffect(() => {
    if (initialRef.current !== initial) {
      setRows(initial)
      setPage(1)
      setDone(false)
      initialRef.current = initial
    }
  }, [initial])

  useEffect(() => {
    if (!sentinel.current || done) return
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loading || done) return
      setLoading(true)
      try {
        const res = await fetch('/api/explore?' + qs({ page: String(page + 1) }))
        const j = await res.json()
        if (j.rows.length === 0) setDone(true)
        else {
          setRows((r) => r.concat(j.rows))
          setPage(page + 1)
          if (page + 1 >= j.pages) setDone(true)
        }
      } catch {}
      setLoading(false)
    }, { rootMargin: '600px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [page, done, loading, qs])

  return (
    <>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((p, i) => (
          <PromptCard key={p.id + '-' + i} item={p} locale={locale as any} isNew={Date.now() - new Date(p.createdAt).getTime() < 48 * 3600 * 1000} />
        ))}
      </div>
      <div ref={sentinel} className="flex h-16 items-center justify-center">
        {loading && <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />}
        {done && rows.length > 0 && <p className="text-xs text-ink-faint">— {locale === 'fa' ? 'پایان' : 'end'} —</p>}
      </div>
    </>
  )
}
