#!/bin/bash
set -e

echo "----- lib/telegram.ts head (for token check) -----"
head -30 src/lib/telegram.ts
echo "---------------------------------------------------"

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/daily5.ts'
let s = fs.readFileSync(p, 'utf8')

// 1) add photo buffer + multipart sender
const helpers = `
async function photoBuffer(promptId: string, fallback: string): Promise<Buffer | null> {
  try {
    const row = await prisma.promptImage.findUnique({ where: { promptId } })
    if (row?.type === 'tg') {
      const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
      const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(row.data), { signal: AbortSignal.timeout(8000) })).json()
      if (g?.result?.file_path) {
        const r = await fetch('https://api.telegram.org/file/bot' + token + '/' + g.result.file_path, { signal: AbortSignal.timeout(20000) })
        if (r.ok) {
          const b = Buffer.from(await r.arrayBuffer())
          if (b.length > 1000) return b
        }
      }
    }
  } catch {}
  try {
    const r = await fetch(fallback, { signal: AbortSignal.timeout(20000) })
    if (r.ok) {
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length > 1000) return b
    }
  } catch {}
  return null
}

async function tgPhotoBytes(chat: string, buf: Buffer, caption: string) {
  const token = process.env.TELEGRAM_OUTPUT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const form = new FormData()
  form.append('chat_id', chat)
  form.append('photo', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg')
  form.append('caption', caption)
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
  return await r.json()
}
`

if (!s.includes('photoBuffer')) {
  s = s.replace('async function directPhoto', helpers + '\nasync function directPhoto')
}

// 2) new send format: photo(caption=title) + code+footer glued
const oldBlock = `      if (out) {
        const photo = await directPhoto(p.id, p.img)
        const tagLine = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\\s+/g, '_')).join(' ')
        await tgSendPhoto(out, photo, '✨ ' + p.titleFa + ' ✨').catch(() => {})
        await tgSendCode(out, p.prompt, '').catch(() => {})
        await tgSendText(out, tagLine + '\\n\\nPROMPTSFA.IR\\n@Prompts_fa').catch(() => {})
      }`

const newBlock = `      if (out) {
        const tagLine = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\\s+/g, '_')).join(' ')
        const footer = tagLine + '\\n\\nPROMPTSFA.IR\\n@Prompts_fa'
        const buf = await photoBuffer(p.id, p.img)
        if (buf) await tgPhotoBytes(out, buf, '✨ ' + p.titleFa + ' ✨').catch(() => {})
        await tgSendCode(out, p.prompt, '\\n\\n' + footer).catch(() => {})
      }`

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock)
  fs.writeFileSync(p, s)
  console.log('✅ daily5: new glued format with real photo')
} else {
  console.log('❌ old block not found — printing send section:')
  const i = s.indexOf("if (d.target === 'daily5tg')")
  console.log(s.slice(i, i + 900))
}
NODEEOF

echo "✅ update122 done!"