export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' }, { fa: 'محصول', en: 'product' },
  { fa: 'سینمایی', en: 'cinematic' }, { fa: 'فانتزی', en: 'fantasy' },
  { fa: 'واقع‌گرایانه', en: 'photorealistic' }, { fa: 'مینیمال', en: 'minimal' },
]

export type GeminiResult = {
  titleFa: string; titleEn: string; descFa: string; descEn: string;
  usageFa: string; usageEn: string; categorySlug: string; subSlug: string | null;
  tagsFa: string[]; tagsEn: string[]; promptEn: string; promptFa: string;
}

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  categories: any[]
}): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS?.split(',')[0]
  if (!apiKey) throw new Error('No API key')

  const instruction = `Analyze this prompt. Return JSON: {"titleFa":"...", "titleEn":"...", "descFa":"...", "descEn":"...", "usageFa":"...", "usageEn":"...", "categorySlug":"image", "subSlug":null, "tagsFa":["tag1"], "tagsEn":["tag1"], "promptEn":"..."}`
  
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction + '\n\nPrompt: ' + opts.text.slice(0, 1000) }] }]
        }),
        signal: AbortSignal.timeout(8000)
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`HTTP ${res.status}: ${err}`)
    }

    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : {}

    return {
      titleFa: parsed.titleFa || 'پرامپت',
      titleEn: parsed.titleEn || 'Prompt',
      descFa: parsed.descFa || '',
      descEn: parsed.descEn || '',
      usageFa: parsed.usageFa || '',
      usageEn: parsed.usageEn || '',
      categorySlug: opts.categories[0]?.slug || 'image',
      subSlug: null,
      tagsFa: Array.isArray(parsed.tagsFa) ? parsed.tagsFa.slice(0, 4) : [],
      tagsEn: Array.isArray(parsed.tagsEn) ? parsed.tagsEn.slice(0, 4) : [],
      promptEn: parsed.promptEn || opts.text,
      promptFa: opts.text,
    }
  } catch (e: any) {
    console.error('[Gemini Error]', e)
    throw new Error(`Gemini failed: ${e.message}`)
  }
}

export async function normalizePrompt(raw: string): Promise<string> {
  return raw
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[\w_]+/g, '')
    .replace(/(t\.me|telegram\.me)\S*/gi, '')
    .trim()
}
