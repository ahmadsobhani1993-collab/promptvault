#!/bin/bash
set -e

# ---------- 1) explore-grid: receive params object, build query internally ----------
cat > src/components/explore-grid.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import PromptCard from '@/components/prompt-card'

type P = any

export default function ExploreGrid({
  initial,
  params,
  locale,
}: {
  initial: P[]
  params: Record<string, string>
  locale: string
}) {
  const [rows, setRows] = useState<P[]>(initial)
  const [page, setPage] = useState(1)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const qs = (page: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    sp.set('page', String(page))
    return sp.toString()
  }

  useEffect(() => {
    setRows(initial)
    setPage(1)
    setDone(false)
  }, [initial])

  useEffect(() => {
    const el = sentinel.current
    if (!el || done) return
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loading || done) return
        setLoading(true)
        try {
          const res = await fetch('/api/explore?' + qs(page + 1))
          const j = await res.json()
          if (!j.rows || j.rows.length === 0) setDone(true)
          else {
            setRows((r) => r.concat(j.rows))
            setPage((p) => p + 1)
            if (page + 1 >= j.pages) setDone(true)
          }
        } catch {}
        setLoading(false)
      },
      { rootMargin: '600px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [page, done, loading])

  return (
    <>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((p, i) => (
          <PromptCard
            key={p.id + '-' + i}
            item={p}
            locale={locale as any}
            isNew={Date.now() - new Date(p.createdAt).getTime() < 48 * 3600 * 1000}
          />
        ))}
      </div>
      <div ref={sentinel} className="flex h-16 items-center justify-center">
        {loading && <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />}
        {done && rows.length > 0 && (
          <p className="text-xs text-ink-faint">— {locale === 'fa' ? 'پایان' : 'end'} —</p>
        )}
      </div>
    </>
  )
}
EOF
echo "✅ explore-grid: params object instead of function"

# ---------- 2) explore page: pass params object ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/explore/page.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  /<ExploreGrid initial=\{rows\} qs=\{\(o\) => qs\(o as any\)\} locale=\{locale\} \/>/,
  '<ExploreGrid initial={rows} params={params as Record<string, string>} locale={locale} />'
)

fs.writeFileSync(p, s)
console.log('✅ explore page: passes params object')
NODEEOF

echo "✅ update95 done!"