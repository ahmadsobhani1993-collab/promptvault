import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // پاک کردن همه وابسته‌ها (cascade) + خود پرامپت‌ها
  const [prompts, images, uploads, scheduled, queue, comments, likes, saves, bookmarks] = await Promise.all([
    prisma.prompt.deleteMany(),
    prisma.promptImage.deleteMany(),
    prisma.uploadImage.deleteMany(),
    prisma.scheduledPost.deleteMany(),
    prisma.telegramQueue.deleteMany(),
    prisma.comment.deleteMany({ where: { promptId: { not: null } } }),
    prisma.like.deleteMany(),
    prisma.save.deleteMany(),
    prisma.bookmark.deleteMany(),
  ])

  // ریست cursor ها
  await prisma.setting.updateMany({
    where: { key: { in: ['import_cursor2', 'import_cursor_msg_id', 'tg_update_offset2'] } },
    data: { value: '1' },
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    deleted: {
      prompts: prompts.count,
      images: images.count,
      uploads: uploads.count,
      scheduled: scheduled.count,
      queue: queue.count,
      comments: comments.count,
      likes: likes.count,
      saves: saves.count,
      bookmarks: bookmarks.count,
    },
  })
}
