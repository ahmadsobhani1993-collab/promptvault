import { CaptionSegment, SocialPostPlan } from './types'

// دیکشنری هوشمند و سرویس کلاینت ترجمه
export async function translateCaptionSegments(
  segments: CaptionSegment[],
  targetLang: 'fa' | 'en'
): Promise<CaptionSegment[]> {
  try {
    const combinedTexts = segments.map((s) => s.text).join('\n---SEG---\n')
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(combinedTexts))
    const data = await res.json()
    
    let fullTranslated = ''
    if (data && data[0]) {
      fullTranslated = data[0].map((item: any) => item[0]).join('')
    }

    const translatedArray = fullTranslated.split(/\n?---SEG---\n?/)

    return segments.map((seg, idx) => {
      const trans = (translatedArray[idx] || seg.text).trim()
      return {
        ...seg,
        translatedText: trans,
      }
    })
  } catch (err) {
    console.warn('Fallback translate:', err)
    return segments
  }
}

export function generateSocialPost(segments: CaptionSegment[]): SocialPostPlan {
  const fullText = segments.map((s) => s.text).join(' ')
  const cleanSummary = fullText.slice(0, 180) + '...'
  
  return {
    platform: 'instagram',
    hook: segments[0]?.text || 'نکته‌ای طلایی که باید بدانید!',
    caption: `✨ خلاصه ویدیو:\n${cleanSummary}\n\n📌 نظر شما در این مورد چیه؟ داخل کامنت‌ها برام بنویسید👇`,
    hashtags: ['#تولید_محتوا', '#آموزش', '#هوش_مصنوعی', '#ویدیو_کپشن', '#پرامپت_فا'],
  }
}
