import type { Metadata } from 'next'
import { getImageUrl } from '@/lib/image-utils'
import { getPromptForPage } from '@/lib/data'
import type { Locale } from '@/lib/i18n'

export function buildSeoTitle(raw: string): string {
  const clean = (raw || '').trim().replace(/^پرامپت\s+/i, '').trim()
  return `پرامپت ${clean} | PromptsFA`
}

export async function generatePromptMetadata(
  params: Promise<{ slug: string }>,
  locale: Locale,
): Promise<Metadata> {
  try {
    const { slug } = await params
    if (!slug || typeof slug !== 'string') return {}
    const item = await getPromptForPage(slug)
    if (!item) return {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
    const pageTitle = locale === 'en'
      ? `${item.titleEn || item.titleFa || 'AI prompt'} | PromptsFA`
      : buildSeoTitle(item.titleFa || '')
    const pageDesc = (locale === 'en'
      ? item.descEn || `Discover and copy this AI prompt for ${item.model}.`
      : item.descFa || `${pageTitle}. مشاهده، کپی و راهنمای استفاده از پرامپت برای مدل هوش مصنوعی ${item.model}.`
    ).slice(0, 160)
    const canonicalPath = `${locale === 'en' ? '/en' : ''}/prompts/${item.slug}`

    let ogImageUrl = `${appUrl}/placeholder.jpg`
    if (item.img && !item.img.includes('placeholder')) {
      ogImageUrl = getImageUrl(item.img)
    }

    return {
      title: { absolute: pageTitle },
      description: pageDesc,
      alternates: {
        canonical: `${appUrl}${canonicalPath}`,
        languages: {
          'fa-IR': `${appUrl}/prompts/${item.slug}`,
          'en-US': `${appUrl}/en/prompts/${item.slug}`,
        },
      },
      openGraph: {
        title: pageTitle,
        description: pageDesc,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: pageTitle }],
        locale: locale === 'en' ? 'en_US' : 'fa_IR',
        siteName: 'PromptsFA',
        url: `${appUrl}${canonicalPath}`,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: pageTitle,
        description: pageDesc,
        images: [ogImageUrl],
      },
    }
  } catch {
    return {}
  }
}
