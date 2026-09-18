import { NextResponse } from 'next/server'

// زنجیره مدل‌های متنی بر اساس اولویت کیفیت و ظرفیت سهمیه
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]

async function callGeminiChain(promptText: string, apiKey: string) {
  let lastError: any = null

  for (const model of CANDIDATE_MODELS) {
    try {
      console.log(`[TRANSLATE-CHAIN] Trying model: ${model}...`)
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.2,
          }
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          console.log(`[TRANSLATE-CHAIN: SUCCESS] Translated via: ${model}`)
          return text
        }
      }

      const errBody = await res.text().catch(() => '')
      console.warn(`[TRANSLATE-CHAIN] Model ${model} returned ${res.status}:${errBody.slice(0, 160)}`)
      lastError = new Error(`Model ${model} failed (${res.status})`)
    } catch (err) {
      console.warn(`[TRANSLATE-CHAIN] Network error on ${model}:`, err)
      lastError = err
    }
  }

  throw lastError || new Error('تمامی مدل‌های زنجیره با محدودیت یا خطا مواجه شدند')
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { srtContent, targetLang = 'fa' } = body

    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'کلید GEMINI_API_KEY در تنظیمات سرور یافت نشد' }, { status: 500 })
    }

    const prompt = `You are an expert subtitle translator.
Translate the dialogue lines in the following SRT subtitles into fluent, natural Persian (${targetLang}).

STRICT RULES:
1. Preserve every subtitle counter index (1, 2, 3...) and timestamp (00:00:00,000 --> 00:00:00,000) EXACTLY as they appear.
2. Only translate the text content of the dialogue.
3. Do NOT add notes, explanations, or wrap the output in markdown fences (no \`\`\`srt). Output plain SRT content only.

SRT:
${srtContent}`

    const rawResult = await callGeminiChain(prompt, apiKey)
    const cleanedSrt = rawResult.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: cleanedSrt || srtContent })
  } catch (err: any) {
    console.error('[TRANSLATE-API: ERROR]', err)
    return NextResponse.json({ error: err?.message || 'خطا در فرآیند ترجمه' }, { status: 500 })
  }
}
