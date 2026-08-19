#!/bin/bash
set -e

# ---------- 1) DB usage monitoring route ----------
mkdir -p src/app/api/debug/db-usage
cat > src/app/api/debug/db-usage/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const now = new Date()
  const hourAgo = new Date(now.getTime() - 3600000)
  const dayAgo = new Date(now.getTime() - 86400000)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const [
    totalViews,
    viewsLastHour,
    viewsLastDay,
    viewsLastWeek,
    topTables,
  ] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: hourAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    ` as any[],
  ])

  // Estimate data transfer (approximate)
  const estimatedTransferMB = (totalViews * 0.5 / 1024).toFixed(2) // ~0.5KB per row

  return NextResponse.json({
    ok: true,
    pageViews: {
      total: totalViews,
      lastHour: viewsLastHour,
      lastDay: viewsLastDay,
      lastWeek: viewsLastWeek,
    },
    estimatedTransferMB,
    topTables: JSON.parse(JSON.stringify(topTables)),
    recommendations: [
      totalViews > 10000 && '📊 تعداد زیادی pageview دارید. batch tracking را فعال کنید.',
      viewsLastHour > 100 && '⚡ ترافیک لحظه‌ای بالا است. caching را بررسی کنید.',
    ].filter(Boolean),
  })
}
EOF
echo "✅ DB usage monitoring route created"

# ---------- 2) Quick stats route ----------
mkdir -p src/app/api/debug/stats
cat > src/app/api/debug/stats/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const [
    prompts,
    users,
    pageViews,
    articles,
  ] = await Promise.all([
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.pageView.count(),
    prisma.article.count(),
  ])

  return NextResponse.json({
    prompts,
    users,
    pageViews,
    articles,
    timestamp: new Date().toISOString(),
  })
}
EOF
echo "✅ Quick stats route"

echo "✅ update181 done!"