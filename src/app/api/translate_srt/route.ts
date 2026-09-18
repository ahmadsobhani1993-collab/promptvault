import { NextResponse } from 'next/server'

// مدل‌های فعال متنی به ترتیب اولویت کیفیت و سهمیه
const MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
]

async function requestTranslation(promptText: string): Promise<string> {
  let lastErr = ''

  // تلاش ۱: فراخوانی از طریق ورکر با ارسال صریح مدل متنی
  for (const model of MODELS) {
    try {
      const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          contents: [{ parts: [{ text: promptText }] }],
        }),
      })

      const raw = await res.text()
      if (res.ok) {
        const parsed = JSON.parse(raw)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
      }
      lastErr = `Worker (${model}):${raw.slice(0, 150)}`
    } catch (e: any) {
      lastErr = e.message
    }
  }

  // تلاش ۲: فراخوانی مستقیم از Google Generative Language API
  const directKey = process.env.GEMINI_API_KEY
  if (directKey) {
    for (const model of MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${directKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.2 }
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) return text
        }
      } catch {}
    }
  }

  throw new Error(lastErr || 'ترجمه از طریق تمام مدل‌ها با شکست مواجه شد')
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const srtContent = body.srtContent || body.srt || ''

    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const promptText = `You are a professional subtitle translator.
Translate the text of the following SRT subtitles into fluent, natural Persian (fa).

CRITICAL REQUIREMENTS:
1. Preserve every subtitle counter index (1, 2, 3...) and timestamp (00:00:00,000 --> 00:00:00,000) EXACTLY as they appear.
2. Only translate the spoken text lines.
3. Return ONLY the raw SRT format. Do NOT wrap in markdown \`\`\` blocks, do not include explanations.

SRT:
${srtContent}`

    const rawResult = await requestTranslation(promptText)
    const cleaned = rawResult.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: cleaned || srtContent })
  } catch (err: any) {
    console.error('[TRANSLATE-API ERROR]:', err)
    return NextResponse.json({ error: err?.message || 'خطا در فرآیند ترجمه' }, { status: 500 })
  }
}
