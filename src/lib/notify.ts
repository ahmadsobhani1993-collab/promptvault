import { prisma } from '@/lib/db'
import { sendPushToUser } from '@/lib/push-notifications'

export async function notify(userId: string, type: string, text: string, url: string) {
  try {
    await prisma.notification.create({ data: { userId, type, text, url } })
  } catch (error) {
    console.error('[Notification] Failed to save in-app notification:', error)
    return
  }

  try {
    const result = await sendPushToUser(userId, { title: 'PromptsFA', body: text, url })
    if (!result.deliveredCount && result.failedCount) {
      console.error('[Notification] Push delivery failed for all subscriptions:', { userId, ...result })
    }
  } catch (error) {
    console.error('[Notification] Push dispatch failed:', { userId, error })
  }
}
