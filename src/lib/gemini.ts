export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' },
  { fa: 'محصول', en: 'product' },
  { fa: 'سینمایی', en: 'cinematic' },
  { fa: 'فانتزی', en: 'fantasy' },
  { fa: 'انیمه', en: 'anime' },
  { fa: 'واقع‌گرایانه', en: 'photorealistic' },
  { fa: 'مینیمال', en: 'minimal' },
  { fa: 'لوکس', en: 'luxury' },
  { fa: 'تاریک', en: 'dark' },
  { fa: 'نئون', en: 'neon' },
  { fa: 'طبیعت', en: 'nature' },
  { fa: 'معماری', en: 'architecture' },
  { fa: 'کاراکتر', en: 'character' },
  { fa: 'لوگو', en: 'logo' },
  { fa: 'پوستر', en: 'poster' },
  { fa: 'تبلیغات', en: 'ads' },
  { fa: 'آموزش', en: 'tutorial' },
  { fa: 'کد', en: 'code' },
  { fa: 'نویسندگی', en: 'writing' },
  { fa: 'بهره‌وری', en: 'productivity' },
  { fa: 'موسیقی', en: 'music' },
  { fa: 'ویدیو', en: 'video' },
  { fa: 'عکاسی', en: 'photography' },
  { fa: 'سه‌بعدی', en: '3d' },
  { fa: 'رنگی', en: 'colorful' },
]

export type GeminiResult = {
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  usageFa: string
  usageEn: string
  categorySlug: string
  subSlug: string | null
  tagsFa: string[]
  tagsEn: string[]
  promptEn: string
  promptFa: string
}

const cleanTitle = (t: string) => t.replace(/^([\u0600-\u06FF\w]+)\s+\1/, '$1')

export const MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
]

export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) {
    parts.push({ inline_data: { mime_type: opts.imgMime || 'image/jpeg', data: opts.imgBase64 } })
  }

  let lastError = ''

  for (const model of MODEL_CHAIN) {
    try {
      console.log(`[Gemini] Trying model: ${model}`)

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
          signal: AbortSignal.timeout(30000),
        }
      )

      const body = await res.text()

      if (res.status === 429) { lastError = model + ': quota'; continue }
      if (res.status === 404) { lastError = model + ': not found'; continue }
      if (!res.ok) { lastError = model + ': HTTP ' + res.status; continue }

      const json = JSON.parse(body)
      const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

      if (!raw) { lastError = model + ': empty'; continue }

      return { text: raw, model }
    } catch (e: any) {
      lastError = model + ': ' + String(e?.message ?? e)
      continue
    }
  }

  throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)
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
    const cleaned = text.trim()
    return cleaned || fallbackClean(raw)
  } catch (e: any) {
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
  // ساخت ساختار category/sub برای Gemini
  const catTree = opts.categories
    .map(
      (c) =>
        `- ${c.slug} (${c.fa} / ${c.en}): ` +
        (c.subs.length
          ? c.subs.map((s) => `${s.slug}(${s.fa}/${s.en})`).join(', ')
          : '(no subcategories)')
    )
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
    '- subSlug: choose ONE EXACT sub slug FROM THE SELECTED CATEGORY, or null if none fits. The sub MUST belong to the chosen category.\n' +
    '- tagsFa: JSON ARRAY of 2-4 items ONLY from this vocabulary: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: English equivalents in SAME ORDER.\n\n' +
    'CATEGORIES & SUBCATEGORIES (choose exact slugs):\n' +
    catTree +
    '\n\nTHE PROMPT TEXT:\n' +
    (opts.text || '(no text, look at image)')

  const { text: raw } = await generateText({ instruction, imgBase64: opts.imgBase64, imgMime: opts.imgMime })

  const m = raw.match(/\{[\s\S]*\}/)
  let parsed: any = {}
  try { parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }

  // اعتبارسنجی category
  const catOk = opts.categories.find((c) => c.slug === parsed.categorySlug)
  const categorySlug = catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image'

  // اعتبارسنجی subSlug
  const chosenCat = opts.categories.find((c) => c.slug === categorySlug)
  let subSlug: string | null = null
  if (parsed.subSlug && chosenCat) {
    const subOk = chosenCat.subs.some((s) => s.slug === parsed.subSlug)
    if (subOk) subSlug = parsed.subSlug
  }

  // تگ‌ها
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
