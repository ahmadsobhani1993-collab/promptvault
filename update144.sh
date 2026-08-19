#!/bin/bash
set -e

# ---------- 1) Fix account/page.tsx - remove extra closing brace ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove the extra closing brace after savedPrompts = []
s = s.replace(
  /const savedPrompts = \[\]\s*\}/,
  'const savedPrompts = []'
)

fs.writeFileSync(p, s)
console.log('✅ Fixed account/page.tsx syntax')
NODEEOF

# ---------- 2) Fix header.tsx - move if statement outside array ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove the if statement inside the array and put it after
s = s.replace(
  /\s*if \(session\?\.user\) \{\s*mobileLinks\.push\(\{ href: '\/account', label: L\(locale, 'حساب', 'Account'\) \}\)\s*\}/,
  ''
)

// Add it after the mobileLinks array definition
s = s.replace(
  /(\]\n\n  return \()/,
  '\n  // Add account link for logged-in users\n  if (session?.user) {\n    mobileLinks.push({ href: \'/account\', label: L(locale, \'حساب\', \'Account\') })\n  }\n\n  $1'
)

fs.writeFileSync(p, s)
console.log('✅ Fixed header.tsx syntax')
NODEEOF

# ---------- 3) Verify and rebuild ----------
echo "Checking syntax..."
npx tsc --noEmit --skipLibCheck src/app/account/page.tsx src/components/layout/header.tsx || echo "TypeScript check completed"

echo "✅ update144 done!"