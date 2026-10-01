import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateText } from '@/lib/gemini'

export const maxDuration = 60

type Cue = { id: string; text: string }

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 })

    const body = await request.json()
    const cues: Cue[] = Array.isArray(body.cues) ? body.cues : []
    if (!cues.length || cues.length > 40 || cues.some((cue) => typeof cue?.id !== 'string' || typeof cue?.text !== 'string')) {
      return NextResponse.json({ error: 'فهرست زیرنویس‌ها معتبر نیست یا بیش از حد طولانی است.' }, { status: 400 })
    }
    if (cues.some((cue) => cue.text.length > 500)) {
      return NextResponse.json({ error: 'یکی از بخش‌های زیرنویس بیش از حد طولانی است.' }, { status: 400 })
    }

    const instruction = `You are a careful Persian subtitle proofreader. Correct obvious spelling and punctuation only.
For every cue, preserve the original language, exact words, word order, and exact number of whitespace-separated words. Do not translate, paraphrase, add, remove, or split words. Only adjust spelling of a word in place and punctuation.
Return only JSON: {"cues":[{"id":"same id","text":"corrected cue"}]}. Return exactly one cue for every input cue, in the same order, with unchanged ids.
Input cues: ${JSON.stringify(cues)}`

    const { text } = await generateText({ instruction, expectJson: true })
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonText) return NextResponse.json({ cues })

    const parsed = JSON.parse(jsonText)
    const returned = Array.isArray(parsed.cues) ? parsed.cues : []
    const byId = new Map(returned.map((cue: any) => [String(cue?.id ?? ''), cue]))
    const safeCues = cues.map((cue) => {
      const proposed: any = byId.get(cue.id)
      if (typeof proposed?.text !== 'string') return cue
      const originalCount = cue.text.trim().split(/\s+/).filter(Boolean).length
      const proposedCount = proposed.text.trim().split(/\s+/).filter(Boolean).length
      return originalCount === proposedCount ? { ...cue, text: proposed.text.trim() } : cue
    })

    return NextResponse.json({ cues: safeCues })
  } catch (error: any) {
    console.error('[Transcript Refine Error]', error)
    return NextResponse.json({ error: error?.message || 'اصلاح نوشتاری زیرنویس انجام نشد.' }, { status: 502 })
  }
}