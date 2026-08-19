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
