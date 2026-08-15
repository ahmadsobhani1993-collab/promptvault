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
}

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  categories: { slug: string; fa: string; en: string }[]
}): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'

  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn"\n' +
    '- titleFa/titleEn: short catchy title (fa/en).\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\n- tagsFa: choose MAX 4 ONLY from: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: English equivalents of chosen tagsFa in same order.'

  const parts: any[] = [{ text: instruction + '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)') }]
  if (opts.imgBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: opts.imgBase64 } })

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: AbortSignal.timeout(25000),
    }
  )

  const json = await res.json()
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  const parsed = m ? JSON.parse(m[0]) : {}

  const tagsFa: string[] = (parsed.tagsFa ?? []).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa: string) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })
  const catOk = opts.categories.some((c) => c.slug === parsed.categorySlug)

  return {
    titleFa: parsed.titleFa || 'پرامپت هوش مصنوعی',
    titleEn: parsed.titleEn || 'AI Prompt',
    descFa: parsed.descFa || '',
    descEn: parsed.descEn || '',
    usageFa: parsed.usageFa || '',
    usageEn: parsed.usageEn || '',
    categorySlug: catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image',
    tagsFa,
    tagsEn,
  }
}
