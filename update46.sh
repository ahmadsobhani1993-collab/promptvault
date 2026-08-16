#!/bin/bash
set -e

# ---------- icon ----------
cat > public/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0805"/>
  <rect x="16" y="16" width="480" height="480" rx="80" fill="none" stroke="#d4a94e" stroke-width="16"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="#d4a94e" text-anchor="middle">P</text>
</svg>
EOF

# ---------- manifest ----------
cat > public/manifest.json << 'EOF'
{
  "name": "PromptsFA",
  "short_name": "PromptsFA",
  "description": "پلتفرم پرامپت‌های هوش مصنوعی",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0805",
  "theme_color": "#d4a94e",
  "dir": "rtl",
  "lang": "fa",
  "icons": [
    { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "/icon.svg", "sizes": "192x192 512x512", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
EOF

# ---------- layout: manifest + theme ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('rel="manifest"')) {
  s = s.replace(
    /<body[^>]*>/,
    (m) => m + `\n      <link rel="manifest" href="/manifest.json" />\n      <meta name="theme-color" content="#d4a94e" />\n      <link rel="icon" href="/icon.svg" type="image/svg+xml" />\n      <meta name="apple-mobile-web-app-capable" content="yes" />\n      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
  )
  fs.writeFileSync(p, s)
  console.log('✅ layout: manifest + theme-color added')
} else console.log('⚠️ manifest already in layout')
NODEEOF

# ---------- footer: render PWAControls ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/footer.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('PWAControls')) {
  s = s.replace(
    "import Link from 'next/link'",
    "import Link from 'next/link'\nimport PWAControls from '@/components/pwa-controls'"
  )
  s = s.replace(
    /<div className="border-t border-line\/50 py-5 text-center text-\[11px\] text-ink-faint">/,
    `<div className="container-app flex flex-wrap items-center justify-center gap-4 border-t border-line/50 py-5">\n        <PWAControls />\n        <p className="text-[11px] text-ink-faint">`
  )
  // close the p properly: original had text directly then </div>
  s = s.replace(
    /© \{new Date\(\)\.getFullYear\(\)\} PromptsFA — همه حقوق محفوظ است\.\n      <\/div>/,
    `© {new Date().getFullYear()} PromptsFA — همه حقوق محفوظ است.</p>\n      </div>`
  )
  fs.writeFileSync(p, s)
  console.log('✅ footer: PWAControls rendered')
} else console.log('⚠️ PWAControls already in footer')
NODEEOF

# ---------- pwa-controls: register SW on load ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/pwa-controls.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes("register('/sw.js')")) {
  s = s.replace(
    "if ('Notification' in window) setPermission(Notification.permission)",
    "if ('Notification' in window) setPermission(Notification.permission)\n    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})"
  )
  fs.writeFileSync(p, s)
  console.log('✅ pwa-controls: SW auto-register')
} else console.log('⚠️ SW register already present')
NODEEOF

echo "✅ PWA fully wired!"