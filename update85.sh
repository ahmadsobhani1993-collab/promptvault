#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/fix-imgs/route.ts'
let s = fs.readFileSync(p, 'utf8')

if (s.includes('force mode')) { console.log('⚠️ already'); process.exit(0) }

const anchor = '  return NextResponse.json({ ok: true, movedRows, movedPrompt, repaired, leftBad, leftRows, leftPrompt, sample, errors: errors.slice(0, 8) })'

const force = `  // ---------- force mode: replace ALL tg-row images with the original channel photo ----------
  if (searchParams.get('force') === '1') {
    let cursor = parseInt((await prisma.setting.findUnique({ where: { key: 'fix_tg_cursor' } }))?.value ?? '0', 10)
    const all = await prisma.prompt.findMany({ where: { slug: { startsWith: 'tg-' } }, select: { id: true, slug: true }, take: 5000 })
    const items = all
      .map((p) => ({ id: p.id, num: parseInt(p.slug.replace('tg-', ''), 10) || 0 }))
      .filter((x) => x.num >= cursor)
      .sort((a, b) => a.num - b.num)
      .slice(0, 100)

    let done = 0
    const ferr: string[] = []
    for (const it of items) {
      const f = await (await fetch(api('forwardMessage', { chat_id: storage, from_chat_id: source!, message_id: String(it.num) }), { signal: AbortSignal.timeout(10000) })).json()
      const fid = f?.result?.photo?.length ? f.result.photo[f.result.photo.length - 1].file_id : null
      if (!fid) { ferr.push(it.num + ': ' + (f?.description ?? 'no photo')); cursor = it.num + 1; continue }
      await prisma.promptImage.upsert({ where: { promptId: it.id }, update: { data: fid, type: 'tg' }, create: { promptId: it.id, data: fid, type: 'tg' } })
      await prisma.prompt.update({ where: { id: it.id }, data: { img: APP + '/api/img/' + it.id } })
      done++
      cursor = it.num + 1
    }
    await prisma.setting.upsert({ where: { key: 'fix_tg_cursor' }, update: { value: String(cursor) }, create: { key: 'fix_tg_cursor', value: String(cursor) } })

    let chained = false
    if (items.length === 100) {
      chained = true
      fetch(APP + '/api/debug/fix-imgs?key=' + (searchParams.get('key') ?? '') + '&force=1&chain=1', { signal: AbortSignal.timeout(8000) }).catch(() => {})
    }
    return NextResponse.json({ ok: true, force: true, done, cursor, chained, ferr: ferr.slice(0, 8) })
  }

`

s = s.replace(anchor, force + anchor)
s = s.replace('export async function GET(req: Request) {', "export async function GET(req: Request) {\n  const { searchParams } = new URL(req.url)")
fs.writeFileSync(p, s)
console.log('✅ force mode added')
NODEEOF

echo "✅ update85 done!"