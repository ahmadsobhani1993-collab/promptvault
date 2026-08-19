#!/bin/bash
set -e

echo "===== تشخیص دقیق مشکلات ====="

# ---------- 1) Check if PageView model exists in schema ----------
echo ""
echo "1. بررسی مدل PageView:"
grep -A 5 "model PageView" prisma/schema.prisma || echo "❌ PageView model not found in schema"

# ---------- 2) Check database for actual data ----------
echo ""
echo "2. بررسی داده‌های واقعی در دیتابیس:"
node << 'NODEEOF'
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  try {
    const pageViews = await prisma.pageView.count()
    console.log('📊 Total page views:', pageViews)
    
    const likes = await prisma.like.count()
    console.log('❤️ Total likes:', likes)
    
    const bookmarks = await prisma.bookmark.count()
    console.log('🔖 Total bookmarks:', bookmarks)
    
    const saves = await prisma.save.count()
    console.log('💾 Total saves:', saves)
    
    const users = await prisma.user.findMany({ select: { id: true, email: true } })
    console.log('👥 Users:', users)
    
  } catch (err) {
    console.error('❌ Database error:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

check()
NODEEOF

# ---------- 3) Create comprehensive debug API ----------
echo ""
echo "3. ساخت API دیباگ کامل:"
mkdir -p src/app/api/debug/full-check
cat > src/app/api/debug/full-check/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
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
  const [likes, bookmarks, saves, prompts, comments, pageViews] = await Promise.all([
    prisma.like.findMany({ 
      where: { userId }, 
      include: { prompt: { select: { titleFa: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.bookmark.findMany({ 
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
    bookmarks: { count: bookmarks.length, items: bookmarks },
    saves: { count: saves.length, items: saves },
    prompts: { count: prompts.length, items: prompts },
    comments: { count: comments.length, items: comments },
    totalPageViews: pageViews,
  }

  return NextResponse.json(result)
}
EOF
echo "✅ Full debug API created"

# ---------- 4) Create test endpoint for tracking ----------
echo ""
echo "4. ساخت endpoint تست tracking:"
mkdir -p src/app/api/debug/test-track
cat > src/app/api/debug/test-track/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Manually create a page view
    await prisma.pageView.create({
      data: {
        path: '/debug/test',
        referrer: 'manual-test',
        ua: 'test-browser',
        ip: '127.0.0.1',
      }
    })
    
    const count = await prisma.pageView.count()
    
    return NextResponse.json({
      ok: true,
      message: 'Test page view created',
      totalPageViews: count,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 })
  }
}
EOF
echo "✅ Test track endpoint created"

echo ""
echo "===== پایان تشخیص ====="