import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'reset') {
    await prisma.setting.upsert({
      where: { key: 'network_tracker_start' },
      update: { value: new Date().toISOString() },
      create: { key: 'network_tracker_start', value: new Date().toISOString() }
    })
    await prisma.setting.upsert({
      where: { key: 'network_tracker_api_calls' },
      update: { value: '0' },
      create: { key: 'network_tracker_api_calls', value: '0' }
    })
    return NextResponse.json({ ok: true, message: 'Tracker reset' })
  }

  if (action === 'log') {
    const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'network_tracker_api_calls' } }))?.value || '0')
    await prisma.setting.upsert({
      where: { key: 'network_tracker_api_calls' },
      update: { value: String(calls + 1) },
      create: { key: 'network_tracker_api_calls', value: String(calls + 1) }
    })
    return NextResponse.json({ ok: true, calls: calls + 1 })
  }

  // Default: show status
  const startTime = (await prisma.setting.findUnique({ where: { key: 'network_tracker_start' } }))?.value
  const apiCalls = (await prisma.setting.findUnique({ where: { key: 'network_tracker_api_calls' } }))?.value || '0'
  
  const totalPrompts = await prisma.prompt.count()
  const lastHour = await prisma.prompt.count({
    where: { createdAt: { gte: new Date(Date.now() - 3600000) } }
  })

  return NextResponse.json({
    ok: true,
    tracker: {
      startTime: startTime || 'not set',
      apiCallsSinceReset: parseInt(apiCalls),
      estimatedNetworkMB: (parseInt(apiCalls) * 0.0005).toFixed(3), // ~0.5KB per API call
    },
    database: {
      totalPrompts,
      newPromptsLastHour: lastHour,
    },
    neonDashboard: {
      message: 'برای دیدن Network Transfer واقعی، به صفحه Overview داشبورد Neon بروید (نه Monitoring)',
      url: 'https://console.neon.tech/app/projects',
      note: 'Network Transfer در بخش Overview > Usage نمایش داده می‌شود',
    },
  })
}
