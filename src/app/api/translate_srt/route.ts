import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const srtContent = body.srtContent || body.srt || ''

    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const promptText = `Translate the dialogue lines in the following SRT subtitles into fluent, natural Persian (fa).
CRITICAL:
1. Preserve every subtitle counter index (1, 2, 3...) and timestamp (00:00:00,000 --> 00:00:00,000) EXACTLY.
2. Only translate the text lines.
3. Do NOT include markdown fences, thoughts or notes. Return raw SRT only.

SRT:
${srtContent}`

    // استفاده از ورکر کلادفلر با متد استاندارد برای پرهیز از نیاز به API Key محلی
    const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    })

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '')
      return NextResponse.json({ error: `Worker error: ${errTxt}` }, { status: res.status })
    }

    const result = await res.json()
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: cleaned || srtContent })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطا در ارتباط با مترجم' }, { status: 500 })
  }
}
