import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { srtContent, targetLang = 'fa' } = await req.json()
    console.log('[TRANSLATE REQUEST] Input Length:', srtContent?.length, 'Target:', targetLang)

    if (!srtContent) {
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const promptText = `Translate the dialogue in the following SRT subtitles to natural, fluent ${targetLang}.
CRITICAL RULES:
1. Preserve every subtitle index number and timestamp format EXACTLY as they are.
2. Only translate the text lines. Do not alter any timestamps or index markers.
3. Return ONLY valid raw SRT content without markdown blocks or explanation.

SRT to translate:
${srtContent}`

    // تست با مدل پیش‌فرض که ورکر از آن پشتیبانی می‌کند
    const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-1.5-flash',
        contents: [{ parts: [{ text: promptText }] }],
      }),
    })

    const rawResp = await res.text()
    console.log('[TRANSLATE WORKER STATUS]:', res.status, 'RAW:', rawResp.slice(0, 300))

    if (!res.ok) {
      throw new Error(`Cloudflare Worker returned ${res.status}: ${rawResp}`)
    }

    const result = JSON.parse(rawResp)
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const translated = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    return NextResponse.json({ srt: translated || srtContent })
  } catch (err: any) {
    console.error('[TRANSLATE BACKEND ERROR]:', err)
    return NextResponse.json({ error: err.message || 'خطا در ترجمه زیرنویس' }, { status: 500 })
  }
}
