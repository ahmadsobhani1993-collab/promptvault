#!/bin/bash
set -e

# ---------- 1) tag-picker definitely fixed ----------
cat > src/components/tag-picker.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function TagPicker({ vocab, max = 4 }: { vocab: { fa: string; en: string }[]; max?: number }) {
  const [sel, setSel] = useState<number[]>([])
  const [q, setQ] = useState('')

  const list = q.trim()
    ? vocab.map((v, i) => ({ v, i })).filter(({ v }) => v.fa.includes(q.trim()) || v.en.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10)
    : vocab.map((v, i) => ({ v, i })).slice(0, 12)

  const toggle = (i: number) => {
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < max ? [...s, i] : s))
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="tagsFa" value={sel.map((i) => vocab[i].fa).join('، ')} />
      <input type="hidden" name="tagsEn" value={sel.map((i) => vocab[i].en).join(', ')} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`جستجوی تگ مجاز... (حداکثر ${max})`}
        className="input"
      />

      {sel.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sel.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright"
            >
              {vocab[i].fa}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {list.map(({ v, i }) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (sel.includes(i)
                ? 'border-gold bg-gold/15 text-gold-bright'
                : 'border-line bg-elevated text-ink-muted hover:border-gold/40')
            }
          >
            {v.fa}
          </button>
        ))}
      </div>
    </div>
  )
}
EOF

# ---------- 2) schema: ensure stars + PushSubscription + User relation ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
let changed = false

// stars on Prompt
const promptBlock = s.match(/model Prompt \{[\s\S]*?\n\}/)
if (promptBlock && !promptBlock[0].includes('stars')) {
  s = s.replace(promptBlock[0], promptBlock[0].replace(/\n\}$/, '\n  stars      Int          @default(0)\n}'))
  changed = true
  console.log('✅ schema: stars added')
}

// PushSubscription model
if (!s.includes('model PushSubscription')) {
  s += '\nmodel PushSubscription {\n  id        String   @id @default(cuid())\n  endpoint  String   @unique\n  keys      String\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n  createdAt DateTime @default(now())\n}\n'
  changed = true
  console.log('✅ schema: PushSubscription added')
}

// User relation
const userBlock = s.match(/model User \{[\s\S]*?\n\}/)
if (userBlock && !userBlock[0].includes('pushSubscriptions')) {
  s = s.replace(userBlock[0], userBlock[0].replace(/\n\}$/, '\n  pushSubscriptions PushSubscription[]\n}'))
  changed = true
  console.log('✅ schema: User.pushSubscriptions added')
}

if (changed) fs.writeFileSync(p, s)
else console.log('⚠️ schema already complete')
NODEEOF

echo "✅ Repair complete — now push the schema and code!"