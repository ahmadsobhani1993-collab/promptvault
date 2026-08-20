#!/bin/bash
set -e

# ---------- 1) Create safe import continuation route ----------
mkdir -p src/app/api/debug/continue-import
cat > src/app/api/debug/continue-import/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const newLimit = parseInt(searchParams.get('limit') || '10000')
  const batchSize = parseInt(searchParams.get('batch') || '50')

  const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const currentStop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660')
  const totalPrompts = await prisma.prompt.count()

  // Update stop limit
  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(newLimit) },
    create: { key: 'import_stop', value: String(newLimit) }
  })

  // Calculate estimated network usage
  const remainingMessages = newLimit - currentCursor
  const estimatedMB = (remainingMessages * 1.4 / 1024).toFixed(2) // 1.4KB per message

  return NextResponse.json({
    ok: true,
    status: {
      currentCursor,
      previousStop: currentStop,
      newStop: newLimit,
      totalPromptsImported: totalPrompts,
      remainingMessages,
    },
    networkEstimate: {
      estimatedMB,
      yourRemainingQuota: '600 MB',
      safe: parseFloat(estimatedMB) < 600,
      message: `بررسی ${remainingMessages} پیام باقی‌مانده فقط ~${estimatedMB} MB مصرف می‌کند (از 600 MB موجود)`,
    },
    nextStep: `حالا این لینک را بزنید تا ${batchSize} پرامپت جدید ایمپورت شود:\nhttps://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${batchSize}`,
    monitorProgress: 'https://promptsfa.ir/api/debug/import-status?key=pv-cron-8x2m1q',
  })
}
EOF
echo "✅ Safe import continuation route created"

# ---------- 2) Create batch import trigger ----------
mkdir -p src/app/api/debug/batch-import
cat > src/app/api/debug/batch-import/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const count = parseInt(searchParams.get('count') || '100')

  const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const stop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '10000')
  const totalBefore = await prisma.prompt.count()

  if (currentCursor >= stop) {
    return NextResponse.json({
      ok: true,
      message: 'Import already completed',
      cursor: currentCursor,
      stop,
    })
  }

  return NextResponse.json({
    ok: true,
    message: `برای ایمپورت ${count} پرامپت جدید، این لینک را بزنید:`,
    importUrl: `https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${count}`,
    statusBefore: {
      cursor: currentCursor,
      stop,
      totalPrompts: totalBefore,
    },
    hint: 'بعد از اجرا، import-status را چک کنید تا پیشرفت را ببینید',
  })
}
EOF
echo "✅ Batch import trigger created"

echo ""
echo "===== SAFE IMPORT CONTINUATION ====="
echo ""
echo "AFTER DEPLOY:"
echo ""
echo "Step 1: Extend limit and see network estimate"
echo "  https://promptsfa.ir/api/debug/continue-import?key=pv-cron-8x2m1q&limit=10000"
echo ""
echo "Step 2: Import 100 prompts at a time"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=100"
echo ""
echo "Step 3: Check progress"
echo "  https://promptsfa.ir/api/debug/import-status?key=pv-cron-8x2m1q"
echo ""
echo "Step 4: Repeat Step 2-3 until all prompts are imported"
echo "======================================"

echo "✅ update211 done!"