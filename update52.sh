#!/bin/bash
set -e

# ---------- 1) force prisma generate on every build ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'package.json'
const j = JSON.parse(fs.readFileSync(p, 'utf8'))
if (!j.scripts.postinstall || !j.scripts.postinstall.includes('prisma generate')) {
  j.scripts.postinstall = 'prisma generate'
  fs.writeFileSync(p, JSON.stringify(j, null, 2))
  console.log('✅ postinstall: prisma generate added')
} else console.log('⚠️ postinstall already set')
NODEEOF

# ---------- 2) cron: only real images ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')
const old = `        const ir = await fetch(img, { signal: AbortSignal.timeout(9000) })
        imgType = ir.headers.get('content-type') ?? 'image/jpeg'
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length > 0 && buf.length < 900_000) imgBase64 = buf.toString('base64')`
const nw = `        const ir = await fetch(img, { signal: AbortSignal.timeout(9000) })
        imgType = ir.headers.get('content-type') ?? ''
        if (imgType.startsWith('image/')) {
          const buf = Buffer.from(await ir.arrayBuffer())
          if (buf.length > 1000 && buf.length < 900_000) imgBase64 = buf.toString('base64')
        }`
if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ cron: image-only guard') }
else console.log('❌ cron guard pattern not found')
NODEEOF

# ---------- 3) article: longer + better images ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace('3-5 friendly practical sentences', '6-8 friendly practical sentences')
s = s.replace('sections: array of 3-4 objects', 'sections: array of 5 objects')
s = s.replace('You are a Persian tech educator.', 'You are a Persian tech educator. Write a COMPLETE long-form article of at least 1200 words in Persian.')
s = s.replace(', cinematic dark luxury style, golden light accents, ultra detailed, no text, no watermark', ', award-winning digital art, cinematic dark luxury style, golden light accents, ultra detailed, 8k, sharp focus, no text, no watermark')
s = s.replace('?width=1200&height=675&seed=', '?model=flux&width=1280&height=720&seed=')
s = s.replace('if (i === 1) {', 'if (i === 1 || i === 3) {')

fs.writeFileSync(p, s)
console.log('✅ article: longer + flux images')
NODEEOF

# ---------- 4) reply depth cap ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/real-comment-box.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  '{kids(c.id).map((k) => renderOne(k, depth + 1))}',
  '{kids(c.id).map((k) => renderOne(k, Math.min(depth + 1, 2)))}'
)
fs.writeFileSync(p, s)
console.log('✅ reply depth capped at 3')
NODEEOF

# ---------- 5) home SEO ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('export const metadata')) {
  s = s.replace(
    "export const dynamic = 'force-dynamic'",
    `export const metadata = {
  title: 'PromptsFA | پلتفرم پرامپت‌های هوش مصنوعی',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن، کد و موسیقی + آموزش‌های روز هوش مصنوعی',
  openGraph: {
    title: 'PromptsFA | پلتفرم پرامپت‌های هوش مصنوعی',
    description: 'کشف، کپی و اشتراک پرامپت‌های حرفه‌ای AI + آموزش روز',
    siteName: 'PromptsFA',
    locale: 'fa_IR',
    images: [{ url: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/icon.svg' }],
  },
  twitter: { card: 'summary_large_image', title: 'PromptsFA', description: 'پلتفرم پرامپت‌های هوش مصنوعی' },
}

export const dynamic = 'force-dynamic'`
  )
}

if (!s.includes('SearchAction')) {
  s = s.replace(
    /return \(\n    <>/,
    `return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'PromptsFA',
            url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir',
            potentialAction: {
              '@type': 'SearchAction',
              target: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/explore?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />`
  )
}

fs.writeFileSync(p, s)
console.log('✅ home SEO added')
NODEEOF

echo "✅ update52 done!"bash update52.sh