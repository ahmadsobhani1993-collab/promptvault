#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// ترتیب دقیق از قوی‌ترین به ضعیف‌ترین (طبق لیست کاربر)
const realModels = `[
  // ===== قوی‌ترین‌ها =====
  'gemini-3.7-flash',           // قوی‌ترین مدل رایگان
  'gemini-3.6-flash',           // بسیار قوی
  'gemini-3.5-flash',           // قوی
  
  // ===== مدل‌های سبک‌تر =====
  'gemini-3.5-flash-lite',      // سبک نسخه 3.5
  'gemini-2.5-flash',           // نسخه 2.5
  'gemini-2.5-flash-lite',      // سبک‌ترین - fallback نهایی
]`

// جایگزینی MODEL_CHAIN
s = s.replace(/export const MODEL_CHAIN = \[[\s\S]*?\]/, `export const MODEL_CHAIN = ${realModels}`)

fs.writeFileSync(p, s)
console.log('✅ مدل‌های Gemini دقیقاً طبق لیست شما تنظیم شدند')
console.log('')
console.log('ترتیب:')
console.log('1. gemini-3.7-flash      ← قوی‌ترین')
console.log('2. gemini-3.6-flash      ← بسیار قوی')
console.log('3. gemini-3.5-flash      ← قوی')
console.log('4. gemini-3.5-flash-lite ← سبک')
console.log('5. gemini-2.5-flash      ← نسخه 2.5')
console.log('6. gemini-2.5-flash-lite ← سبک‌ترین (fallback)')
NODEEOF

echo ""
echo "===== کد نهایی ====="
grep -A 15 "export const MODEL_CHAIN" src/lib/gemini.ts
echo "===================="

echo "✅ update168 done!"