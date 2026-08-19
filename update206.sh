#!/bin/bash
set -e

# ---------- 1) Create import-projection route ----------
mkdir -p src/app/api/debug/import-projection
cat > src/app/api/debug/import-projection/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const stop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660')
  const totalPrompts = await prisma.prompt.count()

  const remaining = Math.max(0, stop - cursor)
  const estimatedMB = remaining * 0.005 // 5KB per import (optimized)
  const estimatedGB = (estimatedMB / 1024).toFixed(3)

  return NextResponse.json({
    ok: true,
    status: {
      cursor,
      stop,
      remaining,
      totalPrompts,
      completed: cursor > 100 ? cursor - 100 : 0,
    },
    projection: {
      estimatedMB: estimatedMB.toFixed(2),
      estimatedGB,
      hint: remaining > 0 
        ? `هنوز ${remaining} پرامپت باقی مانده. با بهینه‌سازی جدید، فقط ~${estimatedMB.toFixed(2)}MB مصرف می‌شود (نه ${estimatedGB}GB!)`
        : '✅ Import کامل شده! دیگر مصرفی برای import نخواهیم داشت.',
      recommendation: 'اگر نمی‌خواهی هیچ مصرفی باشد، در cron-job.org job import-loop را غیرفعال کن',
    },
  })
}
EOF
echo "✅ import-projection route created"

# ---------- 2) Create simple status check ----------
mkdir -p src/app/api/debug/import-status
cat > src/app/api/debug/import-status/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cursor = (await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0'
  const stop = (await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660'
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    importCursor: parseInt(cursor),
    importStop: parseInt(stop),
    totalPrompts,
    isRunning: parseInt(cursor) < parseInt(stop),
    message: parseInt(cursor) < parseInt(stop) 
      ? 'Import still running (cursor < stop)' 
      : 'Import stopped or completed',
  })
}
EOF
echo "✅ import-status route created"

# ---------- 3) Check if routes exist ----------
echo ""
echo "===== Checking created files ====="
ls -la src/app/api/debug/import-projection/route.ts
ls -la src/app/api/debug/import-status/route.ts
echo "==================================="

echo ""
echo "===== AFTER DEPLOY, USE THESE ====="
echo "1. Simple status check:"
echo "   https://promptsfa.ir/api/debug/import-status?key=pv-cron-8x2m1q"
echo ""
echo "2. Detailed projection:"
echo "   https://promptsfa.ir/api/debug/import-projection?key=pv-cron-8x2m1q"
echo "===================================="

echo "✅ update206 done!"