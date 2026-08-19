#!/bin/bash
set -e

# فقط یک خط خراب را در هدر اصلاح می‌کنیم
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// فقط این خط خراب را اصلاح می‌کنیم
const broken = '<Link ).then(() => window.location.href = "/") } } className="btn-secondary text-xs">'
const fixed = '<Link href="/account" className="btn-secondary text-xs">'

if (s.includes(broken)) {
  s = s.replace(broken, fixed)
  fs.writeFileSync(p, s)
  console.log('✅ فقط خط خراب اصلاح شد')
} else {
  console.log('️ خط خراب پیدا نشد - شاید قبلاً اصلاح شده')
}
NODEEOF

echo "✅ update174 done!"