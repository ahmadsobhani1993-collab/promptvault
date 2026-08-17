#!/bin/bash
set -e

# ---------- 1) restore original admin dashboard ----------
git show HEAD~1:src/app/admin/page.tsx > src/app/admin/page.tsx
echo "✅ admin page restored to original"

# ---------- 2) make admin layout + pages mobile-friendly ----------
node << 'NODEEOF'
const fs = require('fs')

function fix(p) {
  if (!fs.existsSync(p)) return
  let s = fs.readFileSync(p, 'utf8')
  const before = s

  // prefixed grids: add mobile base
  s = s.replace(/(md|lg|xl):grid-cols-\[\d+px[_ ,]1fr\]/g, (m) => 'grid-cols-1 ' + m)
  // bare grids: make responsive
  s = s.replace(/(^|\s)grid-cols-\[\d+px[_ ,]1fr\]/g, ' grid-cols-1 lg:grid-cols-[240px_1fr]')
  s = s.replace(/(^|\s)grid-cols-\[1fr[_ ,]\d+px\]/g, ' grid-cols-1 lg:grid-cols-[1fr_240px]')
  // flex rows -> column on mobile
  s = s.replace(/className="flex gap-/g, 'className="flex flex-col lg:flex-row gap-')
  // fixed sidebars -> full width on mobile
  s = s.replace(/(\s)w-64"/g, '$1w-full lg:w-64"')
  s = s.replace(/(\s)w-60"/g, '$1w-full lg:w-60"')
  s = s.replace(/(\s)w-56"/g, '$1w-full lg:w-56"')

  if (s !== before) { fs.writeFileSync(p, s); console.log('✅ responsive: ' + p) }
}

fix('src/app/admin/layout.tsx')
fix('src/app/admin/page.tsx')
fix('src/app/admin/prompts/page.tsx')
fix('src/app/admin/articles/page.tsx')
fix('src/app/admin/categories/page.tsx')
fix('src/app/admin/comments/page.tsx')
fix('src/app/admin/users/page.tsx')
NODEEOF

echo "✅ update78 done!"