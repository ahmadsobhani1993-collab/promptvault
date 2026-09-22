import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const srtContent = body.srtContent || body.srt || ''
    // این خط قبلاً وجود نداشت — targetLang هرگز خوانده و استفاده نمی‌شد
    const targetLang = body.targetLang === 'en' ? 'en' : 'fa'

    if (!srtContent || typeof srtContent !== 'string') {
      return NextResponse.json({ error: 'محتوای زیرنویس معتبر ارسال نشده است' }, { status: 400 })
    }

    const targetLabel = targetLang === 'en' ? 'English (en)' : 'Persian (fa)'

    const instruction = `You are a professional subtitle translator.
Translate the spoken dialogue lines in the following SRT subtitles into natural, fluent ${targetLabel}.

CRITICAL REQUIREMENTS:
1. Preserve every subtitle counter index (1, 2, 3...) and timestamp (00:00:00,000 --> 00:00:00,000) EXACTLY as provided.
2. Only translate the dialogue lines.
3. Return ONLY raw SRT text. Do NOT include explanations or markdown codeblocks (no \`\`\`srt).

SRT:
${srtContent}`

    console.log('[TRANSLATE-NATIVE] Calling gemini.ts generateText... target:', targetLang)
    const result = await generateText({ instruction })

    const cleaned = (result.text || '')
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/```$/i, '')
      .trim()

    return NextResponse.json({ srt: cleaned || srtContent })
  } catch (err: any) {
    console.error('[TRANSLATE-NATIVE: ERROR]', err)
    return NextResponse.json({ error: err.message || 'خطا در ارتباط با هوش مصنوعی' }, { status: 500 })
  }
}