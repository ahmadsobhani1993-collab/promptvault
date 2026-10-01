import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'

type Cue = {
  header: string[]
  timing: string
  text: string
}

function parseSrt(srt: string): Cue[] {
  return srt
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n')
      const timingIndex = lines.findIndex((line) => line.includes('-->'))
      if (timingIndex < 0 || timingIndex === lines.length - 1) return null
      return {
        header: lines.slice(0, timingIndex),
        timing: lines[timingIndex],
        text: lines.slice(timingIndex + 1).join('\n').trim(),
      }
    })
    .filter((cue): cue is Cue => Boolean(cue?.text))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const srtContent = typeof body.srtContent === 'string' ? body.srtContent.trim() : ''
    const targetLang = body.targetLang

    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس معتبر ارسال نشده است' }, { status: 400 })
    }
    if (targetLang !== 'fa' && targetLang !== 'en') {
      return NextResponse.json({ error: 'زبان مقصد باید فارسی یا انگلیسی باشد' }, { status: 400 })
    }

    const cues = parseSrt(srtContent)
    if (!cues.length) {
      return NextResponse.json({ error: 'هیچ بخش قابل ترجمه‌ای در زیرنویس پیدا نشد' }, { status: 400 })
    }

    const targetLanguage = targetLang === 'fa' ? 'natural, fluent Persian (Farsi)' : 'natural, fluent English'
    const instruction = `You are a professional subtitle translator. Translate each subtitle cue into ${targetLanguage}.
Preserve the meaning, tone, names, and punctuation naturally. Translate only the dialogue text; do not add explanations.
Return ONLY valid JSON in this exact shape, with exactly ${cues.length} translated strings and in the same order:
{"translations":["translation for cue 1","translation for cue 2"]}
Do not combine, split, omit, reorder, or add cues. The source cues are:
${JSON.stringify(cues.map((cue) => cue.text))}`

    const { text: generated } = await generateText({ instruction, expectJson: true })
    const cleaned = generated.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const objectText = cleaned.match(/\{[\s\S]*\}/)?.[0]
    if (!objectText) throw new Error('پاسخ ترجمه قالب معتبری نداشت؛ دوباره تلاش کنید.')

    const parsed = JSON.parse(objectText)
    const translations: unknown[] = parsed.translations
    if (!Array.isArray(translations) || translations.length !== cues.length) {
      throw new Error('تعداد ترجمه‌ها با تعداد زیرنویس‌ها برابر نیست؛ دوباره تلاش کنید.')
    }

    const translatedSrt = cues.map((cue, index) => {
      const translatedText = String(translations[index] ?? '').trim()
      if (!translatedText) throw new Error(`ترجمهٔ بخش ${index + 1} خالی است؛ دوباره تلاش کنید.`)
      return [...cue.header, cue.timing, translatedText].join('\n')
    }).join('\n\n')

    return NextResponse.json({ srt: translatedSrt })
  } catch (error: any) {
    console.error('[Translate API Error]:', error)
    return NextResponse.json({ error: error.message || 'خطا در ترجمهٔ زیرنویس' }, { status: 500 })
  }
}