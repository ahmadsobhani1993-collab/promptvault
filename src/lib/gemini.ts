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

// Highest to lowest priority
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

  for (const model of MODEL_CHAIN) {
    console.log(`[Gemini] Attempting model: ${model}`)
    
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

        // 1. Quota exhausted -> Try next KEY for the SAME model
        if (res.status === 429) {
          console.warn(`[Gemini] Key ${i + 1}/${keys.length} quota exhausted for ${model}. Trying next key...`)
          continue
        }

        // 2. Model invalid/deprecated -> ABANDON this model, try NEXT MODEL
        if (res.status === 404 || res.status === 400) {
          console.warn(`[Gemini] Model ${model} is invalid or deprecated (HTTP ${res.status}). Skipping model entirely.`)
          break 
        }

        // 3. Other HTTP errors -> Try next KEY
        if (!res.ok) {
          console.warn(`[Gemini] Key ${i + 1} failed for ${model} with HTTP ${res.status}. Trying next key...`)
          continue
        }

        const json = JSON.parse(body)
        const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        if (!raw) {
          console.warn(`[Gemini] Model ${model} returned empty text. Trying next key...`)
          continue
        }

        console.log(`[Gemini] ✅ Success with model: ${model} using key ${i + 1}`)
        return { text: raw, model }

      } catch (e: any) {
        console.warn(`[Gemini] Key ${i + 1} threw error for ${model}: ${e?.message ?? e}. Trying next key...`)
        continue
      }
    }
  }

  throw new Error(`GEMINI_QUOTA_EXHAUSTED :: All ${keys.length} keys failed across all models.`)
}

export async function normalizePrompt(raw: string): Promise<string> {
  if (!raw || !raw.trim()) return raw
  const instruction =
    'You are a prompt cleaning assistant. Return ONLY the cleaned prompt itself. No explanations, no quotes, no labels.\n\n' +
    'Cleaning rules:\n' +
    '1. REMOVE all promotional noise: Telegram usernames/IDs, Telegram channel names, website names and URLs, "follow/subscribe" sentences, contact info.\n' +
    '2. PRESERVE the original language of the prompt.\n' +
    '3. Keep all technical parameters (--v, --ar, --style, etc.).\n' +
    '4. Output raw prompt text only. No markdown, no code blocks.\n\n' +
    'TEXT TO CLEAN:\n' + raw

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
  const catTree = opts.categories
    .map((c) => `- ${c.slug} (${c.fa} / ${c.en}): ` + (c.subs.length ? c.subs.map((s) => `${s.slug}(${s.fa}/${s.en})`).join(', ') : '(no subcategories)'))
    .join('\n')

  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided).\n' +
    'Return ONLY a valid JSON object (no markdown, no code blocks) with EXACTLY these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","subSlug","tagsFa","tagsEn","promptEn"\n\n' +
    'Rules:\n' +
    '- titleFa/titleEn: short catchy title (fa/en). NEVER repeat a word twice at the start.\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does.\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt.\n' +
    '- promptEn: FULL prompt text translated to English. Keep every detail. If already English, return unchanged.\n' +
    '- categorySlug: choose ONE EXACT slug from the categories below.\n' +
    '- subSlug: choose ONE EXACT sub slug FROM THE SELECTED CATEGORY, or null if none fits.\n' +
    '- tagsFa: JSON ARRAY of 2-4 items ONLY from this vocabulary: ' + TAG_VOCAB.map((t) => t.fa).join('، ') + '\n' +
    '- tagsEn: English equivalents in SAME ORDER.\n\n' +
    'CATEGORIES & SUBCATEGORIES:\n' + catTree + '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)')

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
