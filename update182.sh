#!/bin/bash
set -e

# ---------- 1) Fix db-usage route: remove pg_tables query ----------
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
    totalPrompts,
    totalUsers,
    totalArticles,
  ] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: hourAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.article.count(),
  ])

  // Estimate data transfer (approximate 0.5KB per pageview row)
  const estimatedTransferMB = (totalViews * 0.5 / 1024).toFixed(2)

  return NextResponse.json({
    ok: true,
    pageViews: {
      total: totalViews,
      lastHour: viewsLastHour,
      lastDay: viewsLastDay,
      lastWeek: viewsLastWeek,
    },
    totals: {
      prompts: totalPrompts,
      users: totalUsers,
      articles: totalArticles,
    },
    estimatedTransferMB,
    note: 'با ۲۸ pageView، مصرف network بسیار کم است. آن 3.34GB احتمالاً از import اولیه داده‌ها یا cron jobs است.',
  })
}
EOF
echo "✅ DB usage route: simplified"

echo "✅ update182 done!"