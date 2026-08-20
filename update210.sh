#!/bin/bash
set -e

echo "===== CREATING SEO AUDIT ROUTE ====="

# Create directory structure
mkdir -p src/app/api/seo/audit

# Create the route
cat > src/app/api/seo/audit/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const totalPrompts = await prisma.prompt.count()
  const withDesc = await prisma.prompt.count({ where: { descFa: { not: null, not: '' } } })
  const withTags = await prisma.prompt.count({ where: { tagsFa: { isEmpty: false } } })

  return NextResponse.json({
    ok: true,
    totalPrompts,
    withDescription: withDesc,
    withTags: withTags,
    message: 'SEO audit completed',
  })
}
EOF

echo "✅ Audit route created"

# Verify file exists
if [ -f "src/app/api/seo/audit/route.ts" ]; then
  echo "✅ File verified: src/app/api/seo/audit/route.ts"
  echo ""
  echo "File content:"
  cat src/app/api/seo/audit/route.ts
else
  echo "❌ File not created!"
  exit 1
fi

echo ""
echo "===== NEXT STEPS ====="
echo "1. Run: git add . && git commit -m 'add seo audit route' && git push"
echo "2. Wait for Vercel deploy (2-3 minutes)"
echo "3. Test: https://promptsfa.ir/api/seo/audit?key=pv-cron-8x2m1q"
echo "======================"