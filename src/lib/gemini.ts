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
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
]

function getGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  return raw.split(',').map((k) => k.trim()).filter((k) => k.length > 10)
}

export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) {
    parts.push({ inline_data: { mime_type: opts.imgMime || 'image/jpeg', data: opts.imgBase64 } })
  }

  const keys = getGeminiKeys()
  if (keys.length === 0) throw new Error('No Gemini API keys configured')

  let lastErrorDetail = 'Unknown error'

  for (const model of MODEL_CHAIN) {
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i]
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] }),
            signal: AbortSignal.timeout(30000),
          }
        )

        const body = await res.text()

        if (res.status === 429) {
          console.warn(`[Gemini] Key ${i + 1} quota exhausted.`)
          lastErrorDetail = `HTTP 429 Quota Exceeded`
          continue
        }

        if (res.status === 400 || res.status === 404 || res.status === 401) {
          console.warn(`[Gemini] Model ${model} failed with HTTP ${res.status}. Body:`, body.slice(0, 300))
          lastErrorDetail = `HTTP ${res.status}: ${body.slice(0, 300)}`
          break
        }

        if (!res.ok) {
          lastErrorDetail = `HTTP ${res.status}: ${body.slice(0, 300)}`
          continue
        }

        const json = JSON.parse(body)
        const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        if (!raw) {
          lastErrorDetail = 'Empty response from Gemini (check instruction)'
          continue
        }

        return { text: raw, model }

      } catch (e: any) {
        lastErrorDetail = e?.message ?? String(e)
        continue
      }
    }
  }

  throw new Error(`GEMINI_FAILED :: ${lastErrorDetail}`)
}

export async function normalizePrompt(raw: string): Promise<string> {
  if (!raw || !raw.trim()) return raw
  const instruction =
    'Clean this AI prompt. Remove Telegram usernames, URLs, "follow us" text. Keep only the prompt. Return ONLY the cleaned text:\n\n' + raw

  try {
    const { text } = await generateText({ instruction })
    return text.trim() || fallbackClean(raw)
  } catch {
    return fallbackClean(raw)
  }
}

function fallbackClean(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[\w_]+/g, '')
    .replace(/(t\.me|telegram\.me|promptsfa\.ir|promptsfa)\S*/gi, '')
    .replace(/دنبال\s*کردن|فالو|سابسکرایب|follow|subscribe/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Cat = { slug: string; fa: string; en: string; subs: { slug: string; fa: string; en: string }[] }

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  imgMime?: string
  categories: Cat[]
}): Promise<GeminiResult> {
  const catSlugs = opts.categories.map(c => c.slug).join(', ')
  
  const instruction = `Analyze this AI prompt. Return JSON with these keys: titleFa, titleEn, descFa, descEn, usageFa, usageEn, categorySlug (choose from: ${catSlugs}), subSlug (or null), tagsFa (2-4 from: ${TAG_VOCAB.map(t => t.fa).join(', ')}), tagsEn, promptEn.

Prompt: ${opts.text.slice(0, 1000)}`

  const { text: raw } = await generateText({ instruction, imgBase64: opts.imgBase64, imgMime: opts.imgMime })

  const m = raw.match(/\{[\s\S]*\}/)
  let parsed: any = {}
  try { parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }

  const catOk = opts.categories.find((c) => c.slug === parsed.categorySlug)
  const categorySlug = catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image'

  const chosenCat = opts.categories.find((c) => c.slug === categorySlug)
  let subSlug: string | null = null
  if (parsed.subSlug && chosenCat) {
    if (chosenCat.subs.some((s) => s.slug === parsed.subSlug)) subSlug = parsed.subSlug
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
