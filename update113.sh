#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

const old = `        readFa,
        readEn,
        contentFa,
        contentEn,`

const nw = `        readFa,
        readEn,
        contentFa: contentFa.split(/\\n{1,2}/).map((x: string) => x.trim()).filter(Boolean),
        contentEn: contentEn.split(/\\n{1,2}/).map((x: string) => x.trim()).filter(Boolean),`

if (s.includes(old)) {
  s = s.replace(old, nw)
  fs.writeFileSync(p, s)
  console.log('✅ contentFa/contentEn now String[] (paragraphs array)')
} else console.log('❌ block not found')
NODEEOF

echo "✅ update113 done!"