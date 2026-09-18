import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  console.log('%c[TRANSLATE-API: HIT] Request Received at /api/translate-srt', 'color: #3b82f6; font-weight: bold;')
  try {
    const body = await req.json().catch(() => ({}))
    console.log('[TRANSLATE-API: BODY]:', {
      hasSrt: !!body.srtContent,
      srtLength: body.srtContent?.length,
      targetLang: body.targetLang || 'fa',
    })

    const { srtContent, targetLang = 'fa' } = body
    if (!srtContent) {
      console.error('[TRANSLATE-API: ERROR] Missing srtContent')
      return NextResponse.json({ error: 'محتوای زیرنویس یافت نشد' }, { status: 400 })
    }

    const promptText = `Translate the dialogue in the following SRT subtitles to natural, fluent ${targetLang}.
CRITICAL RULES:
1. Preserve every subtitle index number and timestamp format EXACTLY as they are.
2. Only translate the text lines. Do not alter any timestamps or index markers.
3. Return ONLY valid raw SRT content without markdown blocks or explanation.

SRT to translate:
${srtContent}`

    console.log('[TRANSLATE-API: CALLING CLOUDFLARE WORKER]...')
    const res = await fetch('https://gemini-live-proxy.ahmadsobhani1993.workers.dev/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-1.5-flash',
        contents: [{ parts: [{ text: promptText }] }],
      }),
    })

    console.log('[TRANSLATE-API: WORKER RESPONSE STATUS]:', res.status)
    const rawResp = await res.text()

    if (!res.ok) {
      console.error('[TRANSLATE-API: WORKER RAW ERROR]:', rawResp)
      throw new Error(`Worker returned ${res.status}: ${rawResp}`)
    }

    const result = JSON.parse(rawResp)
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const translated = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()

    console.log('%c[TRANSLATE-API: SUCCESS]: Translated chars:', 'color: #10b981; font-weight: bold;', translated.length)
    return NextResponse.json({ srt: translated || srtContent })
  } catch (err: any) {
    console.error('[TRANSLATE-API: CATCH ERROR]:', err)
    return NextResponse.json({ error: err.message || 'خطا در ترجمه زیرنویس' }, { status: 500 })
  }
}
