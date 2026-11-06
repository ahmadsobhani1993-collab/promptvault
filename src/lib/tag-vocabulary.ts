import type { Locale } from '@/lib/i18n'

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

export function localizePromptTags(
  tagsFa: string[] | null | undefined,
  tagsEn: string[] | null | undefined,
  locale: Locale
) {
  const faTags = Array.isArray(tagsFa) ? tagsFa : []
  const enTags = Array.isArray(tagsEn) ? tagsEn : []

  if (locale === 'en' && faTags.length === 0) return enTags

  return faTags.map((tag, index) => {
    const knownTag = TAG_VOCAB.find((item) => item.fa === tag)
    if (locale === 'fa') return tag
    return knownTag?.en || enTags[index] || tag
  })
}
