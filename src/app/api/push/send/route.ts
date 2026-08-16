import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import webpush from 'web-push'

async function getKeys() {
  let pub = await prisma.setting.findUnique({ where: { key: 'vapid_public' } })
  let priv = await prisma.setting.findUnique({ where: { key: 'vapid_private' } })
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys()
    await prisma.setting.upsert({ where: { key: 'vapid_public' }, update: { value: k.publicKey }, create: { key: 'vapid_public', value: k.publicKey } })
    await prisma.setting.upsert({ where: { key: 'vapid_private' }, update: { value: k.privateKey }, create: { key: 'vapid_private', value: k.privateKey } })
    return k
  }
  return { publicKey: pub.value, privateKey: priv.value }
}

export async function POST(req: Request) {
  const { userId, title, body, url } = await req.json()
  if (!userId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const keys = await getKeys()
  webpush.setVapidDetails('mailto:admin@promptsfa.ir', keys.publicKey, keys.privateKey)

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) },
        JSON.stringify({ title, body, url })
      )
      sent++
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
