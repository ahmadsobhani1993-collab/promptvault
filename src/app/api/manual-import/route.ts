import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 120

export async function GET(req: Request) {
  // بررسی احراز هویت
  const authHeader = req.headers.get('authorization')
  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  
  const isValid = 
    authHeader === 'Bearer pv-cron-8x2m1q' || 
    key === 'pv-cron-8x2m1q'
  
  if (!isValid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const count = Math.min(10, parseInt(url.searchParams.get('count') || '5', 10))
  const results: any[] = []

  try {
    // فراخوانی collect
    const collectRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'}/api/import/collect?count=${count}`, {
      headers: { authorization: 'Bearer pv-cron-8x2m1q' }
    })
    const collectData = await collectRes.json()
    
    if (!collectData.ok || collectData.collected === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'هیچ پرامپت جدیدی در تلگرام نیست',
        collected: 0 
      })
    }

    // فراخوانی import-one به تعداد آیتم‌های جمع‌شده
    for (let i = 0; i < collectData.collected; i++) {
      const importRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'}/api/debug/import-one`, {
        headers: { authorization: 'Bearer pv-cron-8x2m1q' },
        signal: AbortSignal.timeout(90000)
      })
      const importData = await importRes.json()
      results.push(importData)
      
      // صبر کوتاه برای جلوگیری از quota
      await new Promise(r => setTimeout(r, 2000))
    }

    const successCount = results.filter(r => r.ok).length

    return NextResponse.json({
      ok: true,
      message: `✅ ${successCount} پرامپت با موفقیت ایمپورت شد`,
      collected: collectData.collected,
      imported: successCount,
      results
    })

  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: e.message 
    }, { status: 500 })
  }
}
