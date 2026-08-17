#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/fix-imgs/route.ts'
let s = fs.readFileSync(p, 'utf8')

const anchor = '  const leftBad = await prisma.prompt.count'
const sample = `  // diagnostic sample: check getFile for a few tg rows
  const sampleRows = await prisma.promptImage.findMany({ where: { type: 'tg' }, take: 5 })
  const sample: any[] = []
  for (const r of sampleRows) {
    let ok = false
    let desc: string | null = null
    let path: string | null = null
    try {
      const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(r.data), { signal: AbortSignal.timeout(8000) })).json()
      ok = !!g?.result?.file_path
      path = g?.result?.file_path ?? null
      desc = g?.description ?? null
    } catch (e: any) { desc = String(e?.message ?? e) }
    sample.push({ promptId: r.promptId, dataLen: r.data.length, dataHead: r.data.slice(0, 40), getFileOk: ok, path, desc })
  }

`

if (!s.includes('diagnostic sample')) {
  s = s.replace(anchor, sample + anchor)
  s = s.replace(
    'return NextResponse.json({ ok: true, movedRows, movedPrompt, repaired, leftBad, leftRows, leftPrompt, errors: errors.slice(0, 8) })',
    'return NextResponse.json({ ok: true, movedRows, movedPrompt, repaired, leftBad, leftRows, leftPrompt, sample, errors: errors.slice(0, 8) })'
  )
  fs.writeFileSync(p, s)
  console.log('✅ fix-imgs: diagnostic sample added')
} else console.log('⚠️ already')
NODEEOF

echo "✅ update84 done!"
