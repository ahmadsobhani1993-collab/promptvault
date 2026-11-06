import { prisma } from '@/lib/db'
import webpush from 'web-push'

type PushSubscriptionRecord = {
  id: string
  endpoint: string
  keys: string
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
}

export async function getVapidKeys() {
  const [publicSetting, privateSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'vapid_public' } }),
    prisma.setting.findUnique({ where: { key: 'vapid_private' } }),
  ])
  if (publicSetting?.value && privateSetting?.value) {
    return { publicKey: publicSetting.value, privateKey: privateSetting.value }
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const keys = publicKey && privateKey ? { publicKey, privateKey } : webpush.generateVAPIDKeys()

  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'vapid_public' },
      update: { value: keys.publicKey },
      create: { key: 'vapid_public', value: keys.publicKey },
    }),
    prisma.setting.upsert({
      where: { key: 'vapid_private' },
      update: { value: keys.privateKey },
      create: { key: 'vapid_private', value: keys.privateKey },
    }),
  ])
  return keys
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
) {
  if (!subscriptions.length) return { deliveredCount: 0, failedCount: 0 }

  const keys = await getVapidKeys()
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@promptsfa.ir',
    keys.publicKey,
    keys.privateKey,
  )

  let deliveredCount = 0
  let failedCount = 0
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: JSON.parse(subscription.keys) },
        JSON.stringify({ ...payload, url: payload.url || '/', icon: payload.icon || '/icons/icon-192.png' }),
      )
      deliveredCount++
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number(error.statusCode)
        : undefined
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } })
          .catch((deleteError) => console.error('[Push] Failed to remove expired subscription:', deleteError))
        return
      }
      failedCount++
      console.error('[Push] Delivery failed:', { statusCode, error })
    }
  }))

  return { deliveredCount, failedCount }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, keys: true },
  })
  return sendPushToSubscriptions(subscriptions, payload)
}
