#!/bin/bash
set -e

# ---------- 1) Create API to check quota status ----------
mkdir -p src/app/api/debug/quota-check
cat > src/app/api/debug/quota-check/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Check Gemini API quota (if using Gemini)
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  
  const result: any = {
    gemini: { configured: !!geminiKey, keyLength: geminiKey?.length || 0 },
    openai: { configured: !!openaiKey, keyLength: openaiKey?.length || 0 },
    timestamp: new Date().toISOString(),
  }

  // Try a simple Gemini call to check quota
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
          }),
        }
      )
      
      if (res.status === 429) {
        result.gemini.status = 'quota_exhausted'
        result.gemini.message = 'Rate limit or quota exceeded'
      } else if (res.ok) {
        result.gemini.status = 'ok'
      } else {
        result.gemini.status = `error_${res.status}`
      }
    } catch (err: any) {
      result.gemini.status = 'error'
      result.gemini.message = err.message
    }
  }

  return NextResponse.json(result)
}
EOF
echo "✅ Quota check API created"

# ---------- 2) Create API to reset import cursor ----------
mkdir -p src/app/api/debug/reset-cursor
cat > src/app/api/debug/reset-cursor/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Reset import cursor in settings
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: '0' },
    create: { key: 'import_cursor', value: '0' },
  })

  // Also reset chained flag
  await prisma.setting.upsert({
    where: { key: 'import_chained' },
    update: { value: 'false' },
    create: { key: 'import_chained', value: 'false' },
  })

  return NextResponse.json({
    ok: true,
    message: 'Import cursor reset to 0',
    timestamp: new Date().toISOString(),
  })
}
EOF
echo "✅ Reset cursor API created"

# ---------- 3) Improve import-loop error handling ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
if (!fs.existsSync(p)) {
  console.log('⚠️ import-loop route not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Add better error handling for quota exhausted
if (!s.includes('quota_exhausted')) {
  // Find where stopped is set and add quota handling
  s = s.replace(
    /stopped: "quota_exhausted"/,
    `stopped: "quota_exhausted",
    message: "API quota exhausted. Please check your API key or wait for quota reset."`
  )
  
  // Add retry logic or skip on quota error
  if (s.includes('catch (err')) {
    s = s.replace(
      /catch \(err.*?\{/,
      `catch (err: any) {
      const errMsg = err.message || String(err)
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit')) {
        console.error('⚠️ Quota exhausted, stopping import loop')
        return NextResponse.json({
          ok: true,
          stopped: 'quota_exhausted',
          message: 'API quota exhausted. Run /api/debug/reset-cursor to retry later.',
          cursor,
        })
      }`
    )
  }
  
  fs.writeFileSync(p, s)
  console.log('✅ Import loop: better quota error handling')
} else {
  console.log('⚠️ Already has quota handling')
}
NODEEOF

# ---------- 4) Create status page for import ----------
mkdir -p src/app/api/debug/import-status
cat > src/app/api/debug/import-status/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Get current import status
  const [cursor, chained, lastRun] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'import_cursor' } }),
    prisma.setting.findUnique({ where: { key: 'import_chained' } }),
    prisma.setting.findUnique({ where: { key: 'import_last_run' } }),
  ])

  // Count total prompts
  const totalPrompts = await prisma.prompt.count()
  const pendingPrompts = await prisma.prompt.count({ where: { status: 'PENDING' } })
  const publishedPrompts = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })

  return NextResponse.json({
    cursor: cursor?.value || '0',
    chained: chained?.value || 'false',
    lastRun: lastRun?.value || 'never',
    stats: {
      total: totalPrompts,
      pending: pendingPrompts,
      published: publishedPrompts,
    },
    timestamp: new Date().toISOString(),
  })
}
EOF
echo "✅ Import status API created"

echo "✅ update163 done!"
