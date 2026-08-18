#!/bin/bash
set -e

mkdir -p src/app/api/explore

# حالا فایل API را بساز
cat > src/app/api/explore/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 12

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const sort = searchParams.get('sort')
  const type = searchParams.get('type')
  const model = searchParams.get('model')
  const tags = (searchParams.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const q = searchParams.get('q') ?? ''

  const where: any = { status: 'PUBLISHED' }
  if (type) where.type = type
  if (model) where.model = model
  if (tags.length) where.tagsFa = { hasEvery: tags }
  if (q) {
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  const orderBy = sort === 'likes' ? { likes: 'desc' } : sort === 'views' ? { views: 'desc' } : { createdAt: 'desc' }

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true } }),
    prisma.prompt.count({ where }),
  ])

  return NextResponse.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
}
EOF

echo "✅ api/explore created!"

# حالا بقیه update91 را اجرا کن
bash update91.sh