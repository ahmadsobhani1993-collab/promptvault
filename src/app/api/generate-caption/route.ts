import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text, tone = 'engaging', locale = 'fa' } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const tonePrompts: Record<string, string> = {
      engaging: 'هیجانی و اکسپلوری همراه با قلاب (Hook) قوی',
      professional: 'آموزشی، تخصصی و حرفه‌ای',
      friendly: 'صمیمی، داستانی و گرم',
      minimal: 'کوتاه، مینیمال و مستقیم'
    }

    const promptText = `Task: Write an Instagram caption based on the provided text.
Language: ${locale === 'fa' ? 'Persian (Farsi)' : 'English'}
Tone: ${tonePrompts[tone] || tonePrompts.engaging}
Constraints:
- Exactly ONE short paragraph for the main body.
- Include 3 to 5 relevant hashtags at the end.
- Use appropriate emojis naturally.
- Do not make it overly long.

Source Text:
${text}`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    })

    const data = await res.json()
    const caption = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return NextResponse.json({ caption })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to generate caption' }, { status: 500 })
  }
}
