import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const [videoCategory, imageCategory] = await Promise.all([
    prisma.category.findUnique({ where: { slug: 'video' } }),
    prisma.category.findUnique({ where: { slug: 'image' } }),
  ])

  if (!videoCategory) {
    throw new Error('The video category (slug: video) does not exist')
  }

  const { videos, images } = await prisma.$transaction(async (tx) => {
    const videos = await tx.prompt.updateMany({
      where: {
        OR: [
          { type: 'VIDEO' },
          { img: { contains: '.mp4', mode: 'insensitive' } },
          { img: { contains: '.webm', mode: 'insensitive' } },
          { img: { contains: '.ogv', mode: 'insensitive' } },
          { img: { contains: '.ogg', mode: 'insensitive' } },
          { img: { contains: '.mov', mode: 'insensitive' } },
        ],
      },
      data: { type: 'VIDEO', categoryId: videoCategory.id },
    })
    const images = imageCategory
      ? await tx.prompt.updateMany({
          where: { type: 'IMAGE', categoryId: videoCategory.id },
          data: { categoryId: imageCategory.id },
        })
      : { count: 0 }

    return { videos, images }
  })

  console.log(`Repaired ${videos.count} video prompts and ${images.count} image prompts.`)
} finally {
  await prisma.$disconnect()
}
