import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import webpush from 'web-push'

export async function GET() {
  let pub = await prisma.setting.findUnique({ where: { key: 'vapid_public' } })
  let priv = await prisma.setting.findUnique({ where: { key: 'vapid_private' } })

  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys()
    await prisma.setting.upsert({ where: { key: 'vapid_public' }, update: { value: k.publicKey }, create: { key: 'vapid_public', value: k.publicKey } })
    await prisma.setting.upsert({ where: { key: 'vapid_private' }, update: { value: k.privateKey }, create: { key: 'vapid_private', value: k.privateKey } })
    return NextResponse.json({ publicKey: k.publicKey })
  }

  return NextResponse.json({ publicKey: pub.value })
}
