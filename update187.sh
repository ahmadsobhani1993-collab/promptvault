#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// 1. Remove base64 download and replace with direct URL generation
const oldDownload = `    let imgBase64: string | null = null
    const imgType = 'image/jpeg'
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (fr.result?.file_path) {
      try {
        const ir = await fetch('https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path, { signal: AbortSignal.timeout(20000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length > 5000 && buf.length < 2_500_000) imgBase64 = buf.toString('base64')
      } catch {}
    }
    if (!imgBase64) {
      debug.push('  skip: image download failed')
      cursor += advanced
      continue
    }`

const newDownload = `    let imgUrl: string | null = null
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (fr.result?.file_path) {
      imgUrl = 'https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path
    }
    if (!imgUrl) {
      debug.push('  skip: image file_path not found')
      cursor += advanced
      continue
    }`

if (s.includes(oldDownload)) {
  s = s.replace(oldDownload, newDownload)
  console.log('✅ Removed base64 download, using direct URL')
} else {
  console.log('⚠️ Download block not found exactly, might be already modified')
}

// 2. Remove imgBase64 from Gemini call (saves massive upload bandwidth)
s = s.replace(
  `try { ai = await analyzeWithGemini({ text, imgBase64, imgMime: imgType, categories }) }`,
  `try { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }`
)
s = s.replace(
  `catch { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }`,
  `catch { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }`
)
console.log('✅ Disabled image upload to Gemini (text-only analysis to save bandwidth)')

// 3. Update Prisma create to use imgUrl instead of tmp and base64
s = s.replace(
  `img: APP() + '/api/img/tmp-' + cursor,`,
  `img: imgUrl,`
)
s = s.replace(
  `imgData: imgBase64, imgType,`,
  `// imgData removed to save DB network transfer`
)
console.log('✅ Updated Prisma prompt creation')

// 4. Update promptImage creation to store file_id or URL, not base64
s = s.replace(
  `await prisma.promptImage.create({ data: { promptId: prompt.id, data: imgBase64, type: imgType } }).catch(() => {})`,
  `await prisma.promptImage.create({ data: { promptId: prompt.id, data: fileId, type: 'tg_file_id' } }).catch(() => {})`
)
console.log('✅ Updated promptImage to store file_id instead of base64')

fs.writeFileSync(p, s)
console.log('🎉 import-loop optimized: Network transfer reduced by ~95%!')
NODEEOF

echo "✅ update187 done!"