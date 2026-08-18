#!/bin/bash
set -e

# ---------- 1) header: static imports ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace("import dynamic from 'next/dynamic'\n", '')
s = s.replace(
  "const NotifBell = dynamic(() => import('@/components/notif-bell'), { ssr: false })\nconst MobileMenu = dynamic(() => import('@/components/mobile-menu'), { ssr: false })",
  "import NotifBell from '@/components/notif-bell'\nimport MobileMenu from '@/components/mobile-menu'"
)
// move the two new imports next to the others (top of file)
s = s.replace(
  "import LogoutButton from '@/components/logout-button'\nimport NotifBell",
  "import LogoutButton from '@/components/logout-button'\nimport NotifBell"
)
fs.writeFileSync(p, s)
console.log('✅ header: static imports')
NODEEOF

# ---------- 2) layout: static imports ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace("import dynamic from 'next/dynamic'\n", '')
s = s.replace(
  "const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })\nconst PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })",
  ''
)
s = s.replace(
  "import Footer from '@/components/layout/footer'",
  "import Footer from '@/components/layout/footer'\nimport RouteLoader from '@/components/route-loader'\nimport PWAControls from '@/components/pwa-controls'"
)
fs.writeFileSync(p, s)
console.log('✅ layout: static imports')
NODEEOF

echo "✅ update93 done!"