import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { srtContent, targetLang = 'fa' } = await req.json()
    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const promptText = `Translate the dialogue in the following SRT subtitles to natural, fluent ${targetLang}.
CRITICAL RULES:
1. Preserve every subtitle index number and timestamp format EXACTLY as they are.
2. Only translate the text lines. Do not alter any timestamps or index markers.
3. Return ONLY valid raw SRT content without markdown blocks, commentary, or extra explanations.

SRT to translate:
${srtContent}`

    const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-3.5-live-translate',
        contents: [{ parts: [{ text: promptText }] }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Worker status ${res.status}: ${errText}`)
    }

    const result = await res.json()
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const translated = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: translated || srtContent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطا در ترجمه زیرنویس' }, { status: 500 })
  }
}
