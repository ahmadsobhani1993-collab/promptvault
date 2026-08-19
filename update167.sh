#!/bin/bash
set -e

# ---------- به‌روزرسانی با مدل‌های واقعی و قوی‌تر ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// ترتیب از قوی‌ترین به ضعیف‌ترین (همه رایگان در AI Studio)
const realModels = `[
  // ===== قوی‌ترین‌ها (اولویت اول) =====
  'gemini-2.5-pro',             // قوی‌ترین مدل رایگان - استدلال پیشرفته
  'gemini-2.5-flash',           // سریع و بسیار قوی - تعادل عالی
  
  // ===== مدل‌های قدرتمند (اولویت دوم) =====
  'gemini-2.0-flash',           // مدل قبلی قوی - هنوز عالی
  'gemini-2.0-flash-lite',      // سبک و سریع
  
  // ===== مدل‌های حرفه‌ای (اولویت سوم) =====
  'gemini-1.5-pro',             // حرفه‌ای با context 1M tokens
  'gemini-1.5-flash',           // سریع با context 1M tokens
  
  // ===== Fallback نهایی =====
  'gemini-1.5-flash-8b',        // سبک‌ترین - آخرین گزینه
]`

// جایگزینی MODEL_CHAIN
s = s.replace(/export const MODEL_CHAIN = \[[\s\S]*?\]/, `export const MODEL_CHAIN = ${realModels}`)

fs.writeFileSync(p, s)
console.log('✅ مدل‌های Gemini با نسخه‌های واقعی و قوی‌تر به‌روزرسانی شدند')
console.log('')
console.log('ترتیب مدل‌ها:')
console.log('1. gemini-2.5-pro      ← قوی‌ترین (استدلال پیشرفته)')
console.log('2. gemini-2.5-flash    ← سریع و بسیار قوی')
console.log('3. gemini-2.0-flash    ← مدل قبلی قوی')
console.log('4. gemini-2.0-flash-lite ← سبک و سریع')
console.log('5. gemini-1.5-pro      ← حرفه‌ای با context 1M')
console.log('6. gemini-1.5-flash    ← سریع با context 1M')
console.log('7. gemini-1.5-flash-8b ← سبک‌ترین (fallback)')
NODEEOF

echo ""
echo "===== کد نهایی ====="
grep -A 20 "export const MODEL_CHAIN" src/lib/gemini.ts
echo "===================="

echo "✅ update167 done!"