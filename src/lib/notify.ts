import { prisma } from '@/lib/db'

export async function notify(userId: string, type: string, text: string, url: string) {
  try {
    await prisma.notification.create({ data: { userId, type, text, url } })
    await fetch((process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title: 'PromptsFA', body: text, url }),
    }).catch(() => {})
  } catch {}
}
