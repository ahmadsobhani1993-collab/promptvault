import type { CaptionSegment, SocialPostPlan } from '@/lib/studio/types'

const stopWords = new Set([
  'برای', 'این', 'است', 'شده', 'شود', 'یک', 'با', 'از', 'که', 'را', 'در', 'the', 'and', 'for', 'with', 'this', 'that',
])

export function generateSocialPost(segments: CaptionSegment[]): SocialPostPlan {
  const transcript = segments
    .map((segment) => segment.translatedText?.trim() || segment.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')

  if (!transcript) {
    return {
      platform: 'instagram',
      hook: 'ویدیوی جدید من را ببینید!',
      caption: 'این ویدیو را با دوستانتان به اشتراک بگذارید.',
      hashtags: ['#ویدیو', '#محتوا'],
    }
  }

  const firstSentence = transcript.split(/(?<=[.!؟?])\s+/)[0] || transcript
  const hook = firstSentence.length > 100 ? `${firstSentence.slice(0, 97).trimEnd()}...` : firstSentence
  const words = transcript.match(/[\p{L}\p{N}]+/gu) ?? []
  const counts = new Map<string, number>()

  for (const word of words) {
    const normalized = word.toLocaleLowerCase()
    if (normalized.length < 3 || stopWords.has(normalized)) continue
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const hashtags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => `#${word}`)

  return {
    platform: 'instagram',
    hook,
    caption: transcript.length > 500 ? `${transcript.slice(0, 497).trimEnd()}...` : transcript,
    hashtags: hashtags.length ? hashtags : ['#ویدیو', '#محتوا'],
  }
}
