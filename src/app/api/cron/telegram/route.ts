export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendPhoto } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'
import { getImageUrl } from '@/lib/image-utils'

const TG_ID = '@Prompts_fa'
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

function tehranNow() {
  const now = new Date()
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now), 10)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  return { hour, date }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isForceTest = url.searchParams.get('force') === 'true'

  if (!isForceTest && !isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const outChannel = process.env.TELEGRAM_OUTPUT || TG_ID

  const { hour, date } = tehranNow()
  const sentDate = await getSetting('tg_sent_date', '')
  const sentHour = await getSetting('tg_sent_hour', '-1')
  const isDispatchHour = [0, 6, 12, 18].includes(hour)

  if (!isForceTest && (!isDispatchHour || (sentDate === date && sentHour === String(hour)))) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'ساعت ارسال فرا نرسیده یا در این بازه قبلاً ارسال شده است.',
      tehranHour: hour,
    })
  }

  try {
    const totalCount = await prisma.prompt.count({
      where: {
        status: 'PUBLISHED',
        type: 'IMAGE',
        img: { not: '' },
      },
    })

    if (totalCount === 0) {
      return NextResponse.json({ ok: false, error: 'هیچ پرامپت معتبری یافت نشد' }, { status: 404 })
    }

    const skip = Math.floor(Math.random() * totalCount)
    const prompt = await prisma.prompt.findFirst({
      where: {
        status: 'PUBLISHED',
        type: 'IMAGE',
        img: { not: '' },
      },
      skip,
      include: { category: true },
    })

    if (!prompt) {
      return NextResponse.json({ ok: false, error: 'خطا در لود پرامپت تصادفی' }, { status: 404 })
    }

    let finalPhotoUrl = getImageUrl(prompt.img)
    if (finalPhotoUrl.includes('media.promptsfa.ir')) {
      finalPhotoUrl = finalPhotoUrl.replace('media.promptsfa.ir', 'promptfa.s3.eu-west1.arvanstorage.ir')
    }

    const promptUrl = `${APP()}/prompts/${prompt.slug}`

    const cleanTitle = (prompt.titleFa || 'پرامپت جدید هوش مصنوعی')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim()

    const caption = 
`✨ <b>${cleanTitle}</b>

🔗 <a href="${promptUrl}">دیدن و کپی پرامپت در سایت</a>

🆔 ${TG_ID}`

    const sent = await tgSendPhoto(outChannel, finalPhotoUrl, caption, 'HTML')

    if (sent && !isForceTest) {
      await setSetting('tg_sent_date', date)
      await setSetting('tg_sent_hour', String(hour))
    }

    return NextResponse.json({
      ok: true,
      sentSuccessfully: sent,
      prompt: {
        id: prompt.id,
        slug: prompt.slug,
        title: prompt.titleFa,
        img: finalPhotoUrl,
        url: promptUrl,
      },
    })
  } catch (err: any) {
    console.error('Telegram dispatch error:', err)
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}