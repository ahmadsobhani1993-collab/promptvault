import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'reset') {
    // Reset counters
    await prisma.setting.upsert({
      where: { key: 'api_calls_count' },
      update: { value: '0' },
      create: { key: 'api_calls_count', value: '0' },
    })
    await prisma.setting.upsert({
      where: { key: 'api_calls_bytes' },
      update: { value: '0' },
      create: { key: 'api_calls_bytes', value: '0' },
    })
    return NextResponse.json({ ok: true, message: 'Counters reset' })
  }

  if (action === 'report') {
    const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_count' } }))?.value || '0')
    const bytes = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_bytes' } }))?.value || '0')
    
    return NextResponse.json({
      ok: true,
      apiCalls: calls,
      estimatedBytes: bytes,
      estimatedMB: (bytes / 1024 / 1024).toFixed(3),
      hint: 'این آمار از زمان آخرین reset جمع‌آوری شده است',
    })
  }

  // Default status
  const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_count' } }))?.value || '0')
  const bytes = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_bytes' } }))?.value || '0')
  
  return NextResponse.json({
    ok: true,
    current: {
      apiCalls: calls,
      estimatedBytes: bytes,
      estimatedMB: (bytes / 1024 / 1024).toFixed(3),
    },
    instructions: {
      reset: '?action=reset - Reset counters before test',
      import: 'Run import-loop once',
      report: '?action=report - See how much data was used',
    },
  })
}
