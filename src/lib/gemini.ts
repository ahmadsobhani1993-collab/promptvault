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
  'gemini-3.7-flash'
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
      
      if (res.status === 429) { 
        console.warn(`[Gemini] Quota exceeded for ${model}, trying next...`)
        lastError = model + ': quota'
        continue 
      }
      if (res.status === 404) { 
        console.warn(`[Gemini] Model ${model} not found, trying next...`)
        lastError = model + ': not found'
        continue 
      }
      if (!res.ok) { 
        console.warn(`[Gemini] HTTP ${res.status} for ${model}, trying next...`)
        lastError = model + ': HTTP ' + res.status
        continue 
      }
      
      const json = JSON.parse(body)
      const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      
      if (!raw) { 
        console.warn(`[Gemini] Empty response from ${model}, trying next...`)
        lastError = model + ': empty'
        continue 
      }
      
      console.log(`[Gemini] Success with model: ${model}`)
      return { text: raw, model }
      
    } catch (e: any) {
      console.warn(`[Gemini] Error with ${model}: ${e?.message ?? e}. Trying next...`)
      lastError = model + ': ' + String(e?.message ?? e)
      continue
    }
  }
  
  throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)
}

/**
 * تمیزسازی پرامپت:
 * - حذف آیدی تلگرام، اسم کانال، لینک سایت
 * - حفظ زبان اصلی (فارسی/انگلیسی)
 * - ترجمه به انگلیسی اگر زبان دیگری باشد
 */
export async function normalizePrompt(raw: string): Promise<string> {
  if (!raw || !raw.trim()) return raw

  const instruction =
    'You are a prompt cleaning assistant. You receive raw text that contains an AI generation prompt mixed with promotional noise.\n' +
    'Return ONLY the cleaned prompt itself. No explanations, no quotes, no labels.\n\n' +
    'Cleaning rules:\n' +
    '1. REMOVE all promotional noise: Telegram usernames/IDs (e.g. @promptsfa, @channelname), Telegram channel names, website names and URLs (e.g. promptsfa.ir, https://...), "follow/subscribe" sentences, contact info, watermarks.\n' +
    '2. PRESERVE the original language of the prompt:\n' +
    '   - If the prompt is in Persian (فارسی), keep it in Persian exactly.\n' +
    '   - If the prompt is in English, keep it in English exactly.\n' +
    '   - If the prompt is in any other language, translate it to English.\n' +
    '3. Keep all technical parameters (--v, --ar, --style, etc.) exactly as they are.\n' +
    '4. Keep style keywords and descriptive adjectives.\n' +
    '5. Output raw prompt text only. No markdown, no code blocks, no "Prompt:" prefix.\n\n' +
    'TEXT TO CLEAN:\n' + raw

  try {
    const { text } = await generateText({ instruction })
    const cleaned = text.trim()
    return cleaned || fallbackClean(raw)
  } catch (e: any) {
    console.warn(`[Gemini] normalizePrompt failed: ${e?.message ?? e}. Using fallback.`)
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

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  imgMime?: string
  categories: { slug: string; fa: string; en: string }[]
}): Promise<GeminiResult> {
  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn","promptEn"\n' +
    '- titleFa/titleEn: short catchy title (fa/en). NEVER repeat a word twice at the start.\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\n' +
    '- promptEn: the FULL prompt text translated to English. Keep every detail and parameter. If it is already English, return it unchanged.\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\n- tagsFa: JSON ARRAY of MAX 4 items ONLY from: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: JSON ARRAY, English equivalents of chosen tagsFa in same order.' +
    '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)')

  const { text: raw } = await generateText({ instruction, imgBase64: opts.imgBase64, imgMime: opts.imgMime })

  const m = raw.match(/\{[\s\S]*\}/)
  let parsed: any = {}
  try { parsed = m ? JSON.parse(m[0]) : {} } catch { parsed = {} }

  const rawTags = Array.isArray(parsed.tagsFa) ? parsed.tagsFa : String(parsed.tagsFa ?? '').split(/[،,]/)
  const tagsFa: string[] = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })
  
  const catOk = opts.categories.some((c) => c.slug === parsed.categorySlug)

  return {
    titleFa: cleanTitle(String(parsed.titleFa || 'پرامپت هوش مصنوعی')),
    titleEn: cleanTitle(String(parsed.titleEn || 'AI Prompt')),
    descFa: String(parsed.descFa || ''),
    descEn: String(parsed.descEn || ''),
    usageFa: String(parsed.usageFa || ''),
    usageEn: String(parsed.usageEn || ''),
    categorySlug: catOk ? parsed.categorySlug : (opts.categories[0]?.slug ?? 'image'),
    tagsFa,
    tagsEn,
    promptEn: String(parsed.promptEn || opts.text),
    promptFa: String(opts.text || parsed.promptEn || ''),
  }
}
