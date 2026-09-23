export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' }, { fa: 'محصول', en: 'product' }, { fa: 'سینمایی', en: 'cinematic' },
  { fa: 'فانتزی', en: 'fantasy' }, { fa: 'انیمه', en: 'anime' }, { fa: 'واقع‌گرایانه', en: 'photorealistic' },
  { fa: 'مینیمال', en: 'minimal' }, { fa: 'لوکس', en: 'luxury' }, { fa: 'تاریک', en: 'dark' },
  { fa: 'نئون', en: 'neon' }, { fa: 'طبیعت', en: 'nature' }, { fa: 'معماری', en: 'architecture' },
  { fa: 'کاراکتر', en: 'character' }, { fa: 'لوگو', en: 'logo' }, { fa: 'پوستر', en: 'poster' },
  { fa: 'تبلیغات', en: 'ads' }, { fa: 'آموزش', en: 'tutorial' }, { fa: 'کد', en: 'code' },
  { fa: 'نویسندگی', en: 'writing' }, { fa: 'بهره‌وری', en: 'productivity' }, { fa: 'موسیقی', en: 'music' },
  { fa: 'ویدیو', en: 'video' }, { fa: 'عکاسی', en: 'photography' }, { fa: 'سه‌بعدی', en: '3d' },
  { fa: 'رنگی', en: 'colorful' },
]

export type GeminiResult = {
  titleFa: string; titleEn: string; descFa: string; descEn: string;
  usageFa: string; usageEn: string; categorySlug: string; subSlug: string | null;
  tagsFa: string[]; tagsEn: string[]; promptEn: string; promptFa: string;
}

const cleanTitle = (t: string) => t.replace(/^([\u0600-\u06FF\w]+)\s+\1/, '$1')

export const MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]

function getGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  return raw.split(',').map((k) => k.trim()).filter((k) => k.length > 10)
}

export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
  expectJson?: boolean
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) {
    parts.push({
      inlineData: {
        mimeType: opts.imgMime || 'image/jpeg',
        data: opts.imgBase64.replace(/^data:[^;]+;base64,/, '').trim(),
      },
    })
  }

  const keys = getGeminiKeys()
  if (keys.length === 0) {
    throw new Error('GEMINI_FAILED: کلید API برای جمینای در محیط سرور تنظیم نشده است')
  }

  const errors: string[] = []

  for (const model of MODEL_CHAIN) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      try {
        const payload: any = { contents: [{ parts }] }
        if (opts.expectJson) {
          payload.generationConfig = { responseMimeType: 'application/json' }
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(12000),
          }
        )

        const bodyText = await res.text()

        if (!res.ok) {
          errors.push(`${model}: HTTP ${res.status}`)
          continue
        }

        const json = JSON.parse(bodyText)
        const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        if (!raw) {
          errors.push(`${model}: Empty content`)
          continue
        }

        return { text: raw, model }
      } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || String(err).includes('timeout')
        const msg = isTimeout ? 'Timeout (>12s)' : (err?.message || 'Network error')
        errors.push(`${model}: ${msg}`)
        continue
      }
    }
  }

  throw new Error(`GEMINI_FAILED: ${errors.join(' | ')}`)
}

export async function normalizePrompt(raw: string): Promise<string> {
  if (!raw || !raw.trim()) return raw
  try {
    const { text } = await generateText({
      instruction: 'Clean this prompt. Remove Telegram IDs, URLs, follow us text. Return ONLY the cleaned prompt:\n\n' + raw,
    })
    return text.trim() || raw.replace(/https?:\/\/\S+|@[\w_]+|(t\.me|telegram\.me)\S*/gi, '').trim()
  } catch {
    return raw.replace(/https?:\/\/\S+|@[\w_]+|(t\.me|telegram\.me)\S*/gi, '').trim()
  }
}

type Cat = { slug: string; fa: string; en: string; subs: { slug: string; fa: string; en: string }[] }

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64?: string | null
  imgMime?: string
  categories: Cat[]
  mode?: 'auto-import' | 'user-submit'
}): Promise<GeminiResult> {
  const isUserSubmit = opts.mode === 'user-submit'
  const catSlugs = opts.categories.map((c) => c.slug).join(', ')
  const vocabFa = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = isUserSubmit
    ? `You are a tagging assistant. Analyze this prompt and return JSON.
CRITICAL RULES:
1. Return JSON containing: titleFa, titleEn, descFa, descEn, usageFa, usageEn, promptEn.
2. ONLY generate 'tagsFa' (2-4 items strictly from: ${vocabFa}) and 'tagsEn'.
3. Choose the best 'categorySlug' (from: ${catSlugs}) and 'subSlug' (or null).
Input: ${opts.text.slice(0, 2000)}`
    : `You are an AI prompt curator. Analyze this prompt and return JSON.
CRITICAL RULES:
1. 'titleFa' MUST start with the word "پرامپت ".
2. Generate catchy 'titleFa'/'titleEn', short 'descFa'/'descEn', and 'usageFa'/'usageEn'.
3. 'promptEn' is the full prompt translated to English.
4. 'tagsFa' (2-4 items from: ${vocabFa}) and 'tagsEn'.
5. Choose 'categorySlug' (from: ${catSlugs}) and 'subSlug' (or null).
Input: ${opts.text.slice(0, 2000)}`

  const { text: raw } = await generateText({
    instruction,
    imgBase64: opts.imgBase64,
    imgMime: opts.imgMime,
    expectJson: true,
  })

  let parsed: any = {}
  try {
    const cleanedJson = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const m = cleanedJson.match(/\{[\s\S]*\}/)
    parsed = m ? JSON.parse(m[0]) : JSON.parse(cleanedJson)
  } catch {
    parsed = {}
  }

  if (!isUserSubmit) {
    const baseTitle = String(parsed.titleFa || 'هوش مصنوعی').trim()
    parsed.titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`
  }

  const catOk = opts.categories.find((c) => c.slug === parsed.categorySlug)
  const categorySlug = catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image'

  const chosenCat = opts.categories.find((c) => c.slug === categorySlug)
  let subSlug: string | null = null
  if (parsed.subSlug && chosenCat && chosenCat.subs.some((s) => s.slug === parsed.subSlug)) {
    subSlug = parsed.subSlug
  }

  const rawTags = Array.isArray(parsed.tagsFa) ? parsed.tagsFa : String(parsed.tagsFa ?? '').split(/[،,]/)
  const tagsFa: string[] = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })

  return {
    titleFa: cleanTitle(String(parsed.titleFa || 'پرامپت هوش مصنوعی')),
    titleEn: cleanTitle(String(parsed.titleEn || 'AI Prompt')),
    descFa: String(parsed.descFa || ''),
    descEn: String(parsed.descEn || ''),
    usageFa: String(parsed.usageFa || ''),
    usageEn: String(parsed.usageEn || ''),
    categorySlug,
    subSlug,
    tagsFa,
    tagsEn,
    promptEn: String(parsed.promptEn || opts.text),
    promptFa: String(opts.text || parsed.promptEn || ''),
  }
}
