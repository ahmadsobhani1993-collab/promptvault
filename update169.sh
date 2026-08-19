#!/bin/bash
set -e

# ---------- 1) ساخت API تست‌کننده مدل‌ها ----------
mkdir -p src/app/api/debug/test-models
cat > src/app/api/debug/test-models/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  // لیست مدل‌های شما + مدل‌های رسمی شناخته شده برای مقایسه
  const modelsToTest = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    // مدل‌های رسمی و تضمین‌شده رایگان برای مقایسه
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]

  const results: any[] = []

  for (const model of modelsToTest) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
          }),
        }
      )

      const data = await res.json().catch(() => ({}))

      results.push({
        model,
        status: res.status,
        ok: res.ok,
        errorDetails: data.error?.message || (res.ok ? 'Success' : 'Unknown error'),
      })
    } catch (err: any) {
      results.push({
        model,
        status: 'CRASH',
        ok: false,
        errorDetails: err.message,
      })
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
    summary: `Found ${results.filter(r => r.ok).length} working models.`
  })
}
EOF
echo "✅ Model tester API created"

# ---------- 2) بهبود quota-check برای نمایش پیام خطای دقیق ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/quota-check/route.ts'
let s = fs.readFileSync(p, 'utf8')

// اضافه کردن دریافت پیام خطای دقیق از گوگل
if (!s.includes('errorDetails')) {
  s = s.replace(
    /result\.gemini\.status = \`error_\$\{res\.status\}\`/,
    `const errData = await res.json().catch(() => ({}))
        result.gemini.status = 'error_' + res.status
        result.gemini.message = errData.error?.message || 'Unknown error'`
  )
  fs.writeFileSync(p, s)
  console.log('✅ Quota check updated to show exact Google error message')
}
NODEEOF

echo "✅ update169 done!"