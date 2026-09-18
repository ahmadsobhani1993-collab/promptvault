import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { srtContent, targetLang = 'fa' } = await req.json()
    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'کلید جمینای تنظیم نشده است' }, { status: 500 })
    }

    const promptText = `You are an expert subtitle translator. Translate the dialogue in the following SRT subtitles to natural, fluent ${targetLang}. 
CRITICAL RULES:
1. Preserve every subtitle index number and timestamp format EXACTLY as they are.
2. Only translate the text lines. Do not alter any timestamps or index markers.
3. Return ONLY valid raw SRT content without markdown blocks, commentary, or extra explanations.

SRT to translate:
${srtContent}`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData?.error?.message || `Gemini API returned ${response.status}`)
    }

    const result = await response.json()
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const translated = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: translated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطا در ترجمه زیرنویس' }, { status: 500 })
  }
}