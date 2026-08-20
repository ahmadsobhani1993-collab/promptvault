#!/bin/bash
set -e

# ---------- 1) Find which prompts are already imported ----------
mkdir -p src/app/api/debug/find-imported
cat > src/app/api/debug/find-imported/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '5000')

  // Get all prompts with tg- slug
  const existingPrompts = await prisma.prompt.findMany({
    where: {
      slug: {
        startsWith: 'tg-'
      }
    },
    select: {
      slug: true,
      createdAt: true,
      titleFa: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Extract message IDs from slugs
  const importedIds = existingPrompts.map(p => {
    const idStr = p.slug.replace('tg-', '')
    const id = parseInt(idStr)
    return isNaN(id) ? null : id
  }).filter(Boolean) as number[]

  // Find which IDs in range are missing
  const missingIds: number[] = []
  for (let i = startId; i <= endId; i++) {
    if (!importedIds.includes(i)) {
      missingIds.push(i)
    }
  }

  return NextResponse.json({
    ok: true,
    range: { start: startId, end: endId },
    totalInDatabase: existingPrompts.length,
    importedInRange: importedIds.filter(id => id >= startId && id <= endId).length,
    missingInRange: missingIds.length,
    importedIds: importedIds.slice(0, 50), // First 50
    missingIds: missingIds.slice(0, 50), // First 50
    hint: `از ${startId} تا ${endId}: ${missingIds.length} پرامپت ایمپورت نشده`,
    nextStep: `برای ایمپورت این‌ها، import-loop را اجرا کنید. آن‌ها به‌طور خودکار skip می‌شوند.`,
  })
}
EOF
echo "✅ Find imported prompts route created"

# ---------- 2) Update import-loop to handle duplicates gracefully ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Add duplicate check before creating prompt
if (!s.includes('// Check if prompt already exists')) {
  s = s.replace(
    /const prompt = await prisma.prompt.create\(\{/,
    `// Check if prompt already exists
    const existingPrompt = await prisma.prompt.findUnique({ where: { slug: 'tg-' + cursor } })
    if (existingPrompt) {
      debug.push('  skip: already exists')
      cursor += advanced
      continue
    }

    const prompt = await prisma.prompt.create({`
  )
  console.log('✅ Added duplicate check')
}

// Handle duplicate slug error gracefully
if (!s.includes('P2002')) {
  s = s.replace(
    /catch \(e: any\) \{[\s\S]*?debug\.push\('  error: ' \+ msg\)/,
    `catch (e: any) {
      const msg = String(e?.message ?? e)
      
      // Handle duplicate slug error
      if (msg.includes('P2002') || msg.includes('Unique constraint')) {
        debug.push('  skip: duplicate slug (already imported)')
        cursor += advanced
        continue
      }
      
      if (msg.includes('GEMINI_QUOTA_EXHAUSTED') || msg.includes('429')) {`
  )
  console.log('✅ Added graceful duplicate handling')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- 3) Create smart import route that skips existing ----------
mkdir -p src/app/api/debug/smart-import
cat > src/app/api/debug/smart-import/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '10000')
  const batchSize = parseInt(searchParams.get('batch') || '100')

  // Get existing prompt IDs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })

  const importedIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  // Find missing IDs
  const missingIds: number[] = []
  for (let i = startId; i <= endId && missingIds.length < batchSize; i++) {
    if (!importedIds.has(i)) {
      missingIds.push(i)
    }
  }

  // Update cursor to first missing ID
  if (missingIds.length > 0) {
    await prisma.setting.upsert({
      where: { key: 'import_cursor' },
      update: { value: String(missingIds[0]) },
      create: { key: 'import_cursor', value: String(missingIds[0]) }
    })

    await prisma.setting.upsert({
      where: { key: 'import_stop' },
      update: { value: String(endId + 1) },
      create: { key: 'import_stop', value: String(endId + 1) }
    })
  }

  return NextResponse.json({
    ok: true,
    missingIds,
    count: missingIds.length,
    cursor: missingIds.length > 0 ? missingIds[0] : null,
    message: missingIds.length > 0
      ? `${missingIds.length} پرامپت جدید پیدا شد. import-loop را اجرا کنید.`
      : 'همه پرامپت‌ها در این بازه ایمپورت شده‌اند',
    importUrl: missingIds.length > 0
      ? `https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${missingIds.length}`
      : null,
  })
}
EOF
echo "✅ Smart import route created"

echo ""
echo "===== SOLUTION FOR DUPLICATES ====="
echo ""
echo "AFTER DEPLOY:"
echo ""
echo "1. Find which prompts are already imported (3660-5000):"
echo "   https://promptsfa.ir/api/debug/find-imported?key=pv-cron-8x2m1q&start=3660&end=5000"
echo ""
echo "2. Smart import (only missing prompts):"
echo "   https://promptsfa.ir/api/debug/smart-import?key=pv-cron-8x2m1q&start=3660&end=10000&batch=100"
echo ""
echo "3. Then run import-loop:"
echo "   https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=100"
echo ""
echo "4. Check progress:"
echo "   https://promptsfa.ir/api/debug/import-status?key=pv-cron-8x2m1q"
echo "===================================="

echo "✅ update212 done!"