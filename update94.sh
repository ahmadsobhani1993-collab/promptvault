#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// remove dynamic import + declaration
s = s.replace(/import dynamic from 'next\/dynamic'\n/g, '')
s = s.replace(/const HeroCanvas = dynamic\(\(\) => import\('@\/components\/hero-canvas'\), \{ ssr: false \}\)\n*/g, '')

// add static import if missing
if (!s.includes("import HeroCanvas from")) {
  s = "import HeroCanvas from '@/components/hero-canvas'\n" + s
}

fs.writeFileSync(p, s)
console.log('✅ page.tsx: HeroCanvas static import')
NODEEOF

# show any remaining ssr:false anywhere (should be none)
echo "----- remaining ssr:false occurrences -----"
grep -rn "ssr: false" src/ || echo "(none — clean ✅)"
echo "--------------------------------------------"

echo "✅ update94 done!"