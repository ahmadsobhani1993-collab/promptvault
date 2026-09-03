import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getCategories } from '@/lib/data'
import { prisma } from '@/lib/db'
import { TAG_VOCAB } from '@/lib/gemini'
import ExploreClient from '@/components/explore/ExploreClient'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

// 🔑 فقط فیلدهای لازم برای کارت — بدون prompt text سنگین
const CARD_SELECT = {
  slug: true,
  titleFa: true,
  titleEn: true,
  img: true,
  model: true,
  type: true,
  views: true,
  likes: true,
  stars: true,
  tagsFa: true,
  tagsEn: true,
  createdAt: true,
  category: true,
  sub: true,
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const locale
