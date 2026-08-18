#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// 1) ensure next/dynamic imported
if (!s.includes("import dynamic from 'next/dynamic'")) {
  if (s.includes("import type { Metadata }")) {
    s = s.replace("import type { Metadata }", "import dynamic from 'next/dynamic'\nimport type { Metadata }")
  } else {
    s = "import dynamic from 'next/dynamic'\n" + s
  }
  console.log('✅ dynamic imported')
}

// 2) replace static imports of client-only components with dynamic
const dyn = `const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })
const HeroCanvas = dynamic(() => import('@/components/hero-canvas'), { ssr: false })
`

// remove old static imports for these
s = s.replace(/import RouteLoader from [^\n]+\n?/g, '')
s = s.replace(/import PWAControls from [^\n]+\n?/g, '')
s = s.replace(/import HeroCanvas from [^\n]+\n?/g, '')

// insert dynamic declarations right after the last import (or at top after use client)
const lastImportIdx = s.lastIndexOf('\nimport ')
const insertPoint = s.indexOf('\n', lastImportIdx + 1)
if (insertPoint > 0 && !s.includes("const RouteLoader = dynamic")) {
  s = s.slice(0, insertPoint) + '\n' + dyn + s.slice(insertPoint)
  console.log('✅ dynamic declarations inserted')
}

fs.writeFileSync(p, s)
NODEEOF

# 3) hero.tsx: ensure HeroCanvas is also dynamically imported
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero.tsx'
if (!fs.existsSync(p)) return
let s = fs.readFileSync(p, 'utf8')

// if HeroCanvas is imported statically, make it dynamic
if (s.includes("import HeroCanvas from")) {
  s = s.replace(/import HeroCanvas from [^\n]+\n?/g, '')
  if (!s.includes("import dynamic")) {
    s = "import dynamic from 'next/dynamic'\n" + s
  }
  if (!s.includes('const HeroCanvas = dynamic')) {
    s = s.replace(/export default function Hero/, "const HeroCanvas = dynamic(() => import('@/components/hero-canvas'), { ssr: false })\n\nexport default function Hero")
  }
  fs.writeFileSync(p, s)
  console.log('✅ hero.tsx: dynamic HeroCanvas')
}
NODEEOF

# 4) route-loader: guard window check
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/route-loader.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('typeof window')) {
  s = s.replace(
    'useEffect(() => {',
    "useEffect(() => {\n    if (typeof window === 'undefined') return"
  )
  fs.writeFileSync(p, s)
  console.log('✅ route-loader: window guard')
}
NODEEOF

# 5) hero-canvas: explicit window guard
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero-canvas.tsx'
if (!fs.existsSync(p)) return
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('typeof window')) {
  s = s.replace(
    'useEffect(() => {',
    "useEffect(() => {\n    if (typeof window === 'undefined') return"
  )
  fs.writeFileSync(p, s)
  console.log('✅ hero-canvas: window guard')
}
NODEEOF

echo "✅ update86 done!"