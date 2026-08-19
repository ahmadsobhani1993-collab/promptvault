#!/bin/bash
set -e

# ---------- 1) Fix logout button - create proper client component ----------
cat > src/components/logout-button.tsx << 'EOF'
'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton({ label = 'خروج' }: { label?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="btn-secondary"
    >
      {label}
    </button>
  )
}
EOF
echo "✅ LogoutButton client component created"

# ---------- 2) Update header to use the new logout button ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove any broken logout links with onClick
s = s.replace(/href="#" onClick=\{[^}]+\}/g, '')
s = s.replace(/onClick=\(e\) => \{[^}]+\}/g, '')

// Import LogoutButton
if (!s.includes('LogoutButton')) {
  s = s.replace(
    "import LocaleSwitcher from '@/components/locale-switcher'",
    "import LocaleSwitcher from '@/components/locale-switcher'\nimport LogoutButton from '@/components/logout-button'"
  )
}

// Replace inline logout button with component
s = s.replace(
  /<button[^}]*onClick[^}]*>خروج<\/button>/g,
  '<LogoutButton />'
)

fs.writeFileSync(p, s)
console.log('✅ Header: logout button fixed')
NODEEOF

# ---------- 3) Re-enable Analytics component ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Re-enable Analytics
s = s.replace(
  "// import Analytics from '@/components/analytics' // DISABLED FOR DEBUG",
  "import Analytics from '@/components/analytics'"
)
s = s.replace(
  '{/* <Analytics /> */} // DISABLED',
  '<Analytics />'
)

fs.writeFileSync(p, s)
console.log('✅ Analytics re-enabled')
NODEEOF

echo "✅ update173 done!"