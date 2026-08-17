#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/sitemap.xml/route.ts'
if (!fs.existsSync(p)) { console.log('⚠️ sitemap not found'); process.exit(0) }
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('dynamic')) {
  s = s.replace(/export /, "export const dynamic = 'force-dynamic'\nexport const revalidate = 3600\nexport ")
  fs.writeFileSync(p, s)
  console.log('✅ sitemap: dynamic + revalidate added')
} else console.log('⚠️ sitemap already has dynamic')
NODEEOF

echo "✅ update71 done!"