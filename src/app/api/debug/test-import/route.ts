import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    // Get one pending prompt to test
    const prompt = await prisma.prompt.findFirst({
      where: { status: 'PENDING' },
      include: { category: true },
    })

    if (!prompt) {
      return NextResponse.json({
        ok: true,
        message: 'No pending prompts to process',
        totalPublished: await prisma.prompt.count({ where: { status: 'PUBLISHED' } }),
      })
    }

    // Try to analyze it
    console.log(' Testing analysis for prompt:', prompt.id)
    
    const result = await analyzeWithGemini({
      text: prompt.text || '',
      imgBase64: null,
      imgMime: undefined,
      categories: await prisma.category.findMany({ select: { slug: true, fa: true, en: true } }),
    })

    // Update the prompt
    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        titleFa: result.titleFa,
        titleEn: result.titleEn,
        descFa: result.descFa,
        descEn: result.descEn,
        prompt: result.promptEn,
        tagsFa: result.tagsFa,
        tagsEn: result.tagsEn,
        categoryId: (await prisma.category.findUnique({ where: { slug: result.categorySlug } }))?.id,
        status: 'PUBLISHED',
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Successfully processed one pending prompt',
      promptId: prompt.id,
      result,
    })
  } catch (err: any) {
    console.error('❌ Test import error:', err)
    
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      return NextResponse.json({
        ok: false,
        error: 'quota_exhausted',
        message: 'Gemini API quota exhausted. Please wait or use a different API key.',
      }, { status: 429 })
    }
    
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 })
  }
}
