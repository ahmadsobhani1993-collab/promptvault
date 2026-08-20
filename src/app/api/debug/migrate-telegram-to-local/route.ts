import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const batchSize = parseInt(searchParams.get('batch') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Find prompts with Telegram URLs
  const prompts = await prisma.prompt.findMany({
    where: {
      img: { contains: 'api.telegram.org' }
    },
    select: { id: true, slug: true, img: true },
    take: batchSize,
    skip: offset,
  })

  if (prompts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No more Telegram URLs to migrate',
    })
  }

  let successCount = 0
  let failCount = 0

  for (const prompt of prompts) {
    try {
      // Download image from Telegram
      const imgRes = await fetch(prompt.img!, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })

      if (!imgRes.ok) {
        failCount++
        continue
      }

      const blob = await imgRes.blob()
      const buffer = Buffer.from(await blob.arrayBuffer())
      
      // Generate unique ID
      const id = `cmt${Date.now()}${Math.random().toString(36).substring(7)}`
      
      // Save to /public/api/img/
      const fs = require('fs')
      const path = require('path')
      const imgPath = path.join(process.cwd(), 'public', 'api', 'img', `${id}.jpg`)
      
      fs.mkdirSync(path.dirname(imgPath), { recursive: true })
      fs.writeFileSync(imgPath, buffer)

      // Update database
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { img: `/api/img/${id}.jpg` },
      })

      successCount++
    } catch (err) {
      console.error(`Failed to migrate ${prompt.slug}:`, err)
      failCount++
    }
  }

  const nextOffset = offset + batchSize

  return NextResponse.json({
    ok: true,
    batch: {
      processed: prompts.length,
      success: successCount,
      failed: failCount,
    },
    progress: {
      currentOffset: offset,
      nextOffset,
    },
    nextUrl: `?batch=${batchSize}&offset=${nextOffset}`,
  })
}
