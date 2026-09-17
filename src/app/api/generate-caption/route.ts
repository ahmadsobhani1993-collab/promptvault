import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'

export async function POST(req: Request) {
  try {
    const { text, tone = 'engaging', locale = 'fa' } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'متن ورودی معتبر نیست' }, { status: 400 })
    }

    const tonePrompts: Record<string, string> = {
      engaging: 'Engaging, viral hooks, dynamic tone with high social media retention',
      professional: 'Professional, educational, clear, authoritative',
      friendly: 'Warm, storytelling, conversational and friendly',
      minimal: 'Punchy, ultra-minimal, 1-2 powerful sentences'
    }

    const isEn = locale === 'en'
    const promptText = `Act as an expert Instagram caption creator.
Output Language: ${isEn ? 'English' : 'Persian (Farsi)'}
Tone style: ${tonePrompts[tone] || tonePrompts.engaging}

Task:
- Write ONE engaging paragraph summarizing the core message with an attention-grabbing hook.
- Use emojis naturally.
- Conclude with 4-5 relevant hashtags.
- DO NOT wrap the output in quotes or add conversational filler.

Source Text:
${text.slice(0, 3000)}`

    const { text: caption } = await generateText({ instruction: promptText })

    return NextResponse.json({ caption: caption.trim() })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error generating caption' }, { status: 500 })
  }
}
