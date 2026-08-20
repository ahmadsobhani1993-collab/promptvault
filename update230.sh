#!/bin/bash
set -e

mkdir -p src/app/api/debug/import-all-new
cat > src/app/api/debug/import-all-new/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startCursor = parseInt(searchParams.get('start') || '506')
  const stopCursor = parseInt(searchParams.get('stop') || '1885')

  // Update cursor and stop
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: String(startCursor) },
    create: { key: 'import_cursor', value: String(startCursor) }
  })

  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(stopCursor) },
    create: { key: 'import_stop', value: String(stopCursor) }
  })

  const totalPromptsBefore = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    message: `Import range set: ${startCursor} to ${stopCursor}`,
    totalPromptsBefore,
    nextStep: `Now run: /api/import-loop?key=pv-cron-8x2m1q&count=100`,
    estimatedNetworkMB: ((stopCursor - startCursor) * 0.002).toFixed(2),
  })
}
EOF
echo "✅ Import all new route created"

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Step 1: Set import range (506 to 1885)"
echo "  https://promptsfa.ir/api/debug/import-all-new?key=pv-cron-8x2m1q&start=506&stop=1885"
echo ""
echo "Step 2: Run import-loop (will skip already imported, only import new ones)"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=100"
echo ""
echo "Step 3: Check results"
echo "  https://promptsfa.ir/api/debug/check-db-images?key=pv-cron-8x2m1q"
echo ""
echo "=================================="

echo "✅ update230 done!"