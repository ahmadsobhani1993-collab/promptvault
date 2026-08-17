#!/bin/bash
set -e

# ---------- 1) telegram lib: fresh image per post ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/telegram.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('fetchFreshImage')) {
  s += `

// get a FRESH signed image URL by opening the single post page
export async function fetchFreshImage(username: string, id: number): Promise<string | null> {
  const url = 'https://t.me/' + username + '/' + id
  let html: string | null = null
  try {
    html = await fetchText(url, 7000)
  } catch {
    try {
      html = await fetchText('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), 9000)
    } catch {}
  }
  if (!html) return null
  const m = html.match(/background-image:url\\('([^']+)'\\)/)
  if (!m) return null
  return m[1].startsWith('//') ? 'https:' + m[1] : m[1]
}
`
  fs.writeFileSync(p, s)
  console.log('✅ telegram: fetchFreshImage added')
} else console.log('⚠️ already has fetchFreshImage')

// add allorigins as generic proxy in downloadImage
if (!s.includes('allorigins.win/raw?url=' + "' + encodeURIComponent(imgUrl))")) {
  s = s.replace(
    "methods.push('https://images.weserv.nl/?url=' + encodeURIComponent(imgUrl) + '&output=jpg')",
    "methods.push('https://images.weserv.nl/?url=' + encodeURIComponent(imgUrl) + '&output=jpg')\n    methods.push('https://api.allorigins.win/raw?url=' + encodeURIComponent(imgUrl))"
  )
  fs.writeFileSync(p, s)
  console.log('✅ downloadImage: allorigins proxy added')
}
NODEEOF

# ---------- 2) cron: refresh image URL before download ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  "import { fetchPage, diagnoseChannel, verifyImage, tgSendText, tgSendPhoto, tgSendCode, downloadImage } from '@/lib/telegram'",
  "import { fetchPage, diagnoseChannel, verifyImage, tgSendText, tgSendPhoto, tgSendCode, downloadImage, fetchFreshImage } from '@/lib/telegram'"
)

const old = `    let promptText = (item.text ?? '').trim()
    let img = item.img
    const skipIds: number[] = []`
const nw = `    let promptText = (item.text ?? '').trim()
    let img = item.img
    const skipIds: number[] = []

    // refresh image URL from the live post page (old signed URLs expire)
    try {
      const fresh = await fetchFreshImage(channel, item.id)
      if (fresh) img = fresh
    } catch {}`

if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ cron: fresh image refresh') }
else console.log('❌ cron refresh pattern not found')
NODEEOF

echo "✅ update55 done!"
