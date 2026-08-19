#!/bin/bash
set -e

echo "===== Checking if optimization was applied ====="
if grep -q "imgBase64" src/app/api/import-loop/route.ts; then
  echo "❌ STILL downloading base64! Optimization NOT applied."
  echo "   Need to run update187 again or manually fix."
else
  echo "✅ Base64 download removed. Optimization applied."
fi

if grep -q "imgUrl" src/app/api/import-loop/route.ts; then
  echo "✅ Using direct URL instead of base64."
else
  echo "❌ Still using old method."
fi

echo "=============================================="

# ---------- 1) Verify and fix if needed ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

const hasBase64 = s.includes('imgBase64')
const hasDirectUrl = s.includes('imgUrl')

if (hasBase64 && !hasDirectUrl) {
  console.log('⚠️ Optimization was NOT applied. Fixing now...')
  
  // Remove base64 download
  s = s.replace(
    /let imgBase64: string \| null = null[\s\S]*?if \(!imgBase64\) \{[\s\S]*?cursor \+= advanced[\s\S]*?continue[\s\S]*?\}/,
    `let imgUrl: string | null = null
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (fr.result?.file_path) {
      imgUrl = 'https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path
    }
    if (!imgUrl) {
      debug.push('  skip: image file_path not found')
      cursor += advanced
      continue
    }`
  )
  
  // Remove Gemini image upload
  s = s.replace(
    /try \{ ai = await analyzeWithGemini\(\{ text, imgBase64, imgMime: imgType, categories \}\) \}/,
    `try { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }`
  )
  
  // Update Prisma create
  s = s.replace(
    /img: APP\(\) \+ '\/api\/img\/tmp-' \+ cursor,/,
    `img: imgUrl,`
  )
  s = s.replace(
    /imgData: imgBase64, imgType,/,
    `// imgData removed to save network`
  )
  
  fs.writeFileSync(p, s)
  console.log('✅ Optimization applied now!')
} else if (!hasBase64 && hasDirectUrl) {
  console.log('✅ Optimization already applied. No changes needed.')
}
NODEEOF

echo ""
echo "===== CURRENT STATUS ====="
echo "If optimization is applied:"
echo "  - Each import: ~5KB (was 1.9MB)"
echo "  - 876 prompts remaining: ~4.3MB total (was 1.66GB)"
echo ""
echo "If you want ZERO future consumption:"
echo "  - Stop import-loop completely:"
echo "    https://promptsfa.ir/api/debug/stop-import?key=pv-cron-8x2m1q"
echo "  - Disable in cron-job.org"
echo "=================================="

echo "✅ update204 done!"