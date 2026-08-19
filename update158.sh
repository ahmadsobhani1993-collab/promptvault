#!/bin/bash
set -e

echo "===== مشکل پیدا شد! ====="
echo "سیستم از مدل 'Save' استفاده می‌کند نه 'Bookmark'"
echo ""

# ---------- 1) Fix account page: use Save instead of Bookmark ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Replace bookmark with save
s = s.replace(
  /const bookmarks = await prisma\.bookmark\.findMany/g,
  'const saves = await prisma.save.findMany'
)

s = s.replace(
  /savedPrompts = bookmarks\.map\(b => b\.prompt\)\.filter\(Boolean\)/,
  'savedPrompts = saves.map(s => s.prompt).filter(Boolean)'
)

s = s.replace(
  /console\.log\('DEBUG: Found', bookmarks\.length, 'bookmarks for user', session\.user\.id\)/,
  "console.log('✅ Fetched saves:', saves.length, 'for user', session.user.id)"
)

s = s.replace(
  /Bookmarks not available/,
  'Saves not available'
)

fs.writeFileSync(p, s)
console.log('✅ Account page: changed Bookmark to Save')
NODEEOF

# ---------- 2) Fix full-check API: handle Save model ----------
cat > src/app/api/debug/full-check/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    
    const result: any = {
      authenticated: !!session?.user,
      userId: session?.user?.id,
      email: session?.user?.email,
    }

    if (!session?.user) {
      return NextResponse.json(result)
    }

    const userId = session.user.id

    // Check all user activities
    const [likes, saves, prompts, comments, pageViews] = await Promise.all([
      prisma.like.findMany({ 
        where: { userId }, 
        include: { prompt: { select: { titleFa: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.save.findMany({ 
        where: { userId }, 
        include: { prompt: { select: { titleFa: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.prompt.findMany({ 
        where: { userId },
        select: { titleFa: true, slug: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.comment.findMany({ 
        where: { userId },
        include: { prompt: { select: { titleFa: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.pageView.count(),
    ])

    result.activity = {
      likes: { count: likes.length, items: likes },
      saves: { count: saves.length, items: saves },
      prompts: { count: prompts.length, items: prompts },
      comments: { count: comments.length, items: comments },
      totalPageViews: pageViews,
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('❌ Full-check error:', err)
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 })
  }
}
EOF
echo "✅ Full-check API fixed"

# ---------- 3) Remove unused Bookmark model (optional) ----------
echo ""
echo "نکته: مدل Bookmark در schema وجود دارد اما استفاده نمی‌شود."
echo "می‌توانی آن را حذف کنی یا نگه داری."

echo ""
echo "✅ update158 done!"