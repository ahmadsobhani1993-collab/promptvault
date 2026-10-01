import { createHmac, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

async function getLocalAlignmentSecret(): Promise<string> {
  const secretPath = join(process.cwd(), '.alignment-token-secret')
  try {
    return (await readFile(secretPath, 'utf8')).trim()
  } catch {
    try { return (await readFile(join(process.cwd(), '.whisper-token-secret'), 'utf8')).trim() } catch {}
    const generated = randomBytes(32).toString('hex')
    try {
      await writeFile(secretPath, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      return generated
    } catch {
      return (await readFile(secretPath, 'utf8')).trim()
    }
  }
}

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'برای هم‌ترازی ابتدا وارد حساب کاربری شوید.' }, { status: 401 })

    const localDevelopment = process.env.NODE_ENV === 'development'

    // ✅ تغییر اصلی: استفاده از Cloudflare Worker به جای localhost:8000
    // اولویت: . متغیر محیطی ۲. Cloudflare Worker پیش‌فرض ۳. localhost (فقط در dev)
    const cloudflareWorkerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev'
    
    const serviceUrl = (
      process.env.ALIGNMENT_SERVICE_URL || 
      process.env.WHISPER_SERVICE_URL || 
      (localDevelopment ? cloudflareWorkerUrl : cloudflareWorkerUrl)
    ).trim().replace(/\/$/, '')

    // ✅ سیکرت: اول از env، بعد از فایل محلی، در نهایت مقدار پیش‌فرض برای تست
    const secret = 
      process.env.ALIGNMENT_TOKEN_SECRET || 
      process.env.WHISPER_TOKEN_SECRET || 
      process.env.ALIGN_SHARED_SECRET ||
      (localDevelopment ? await getLocalAlignmentSecret() : 'test-secret')

    // ✅ بررسی تنظیمات
    if (!serviceUrl) {
      return NextResponse.json({ 
        error: 'آدرس سرویس alignment تنظیم نشده است. CLOUDFLARE_WORKER_URL را در .env.local تنظیم کنید.' 
      }, { status: 503 })
    }

    if (!secret || secret.length < 8) {
      return NextResponse.json({ 
        error: localDevelopment
          ? 'سرویس alignment آماده است اما سیکرت معتبر نیست. ALIGN_SHARED_SECRET را در Cloudflare Worker تنظیم کنید.'
          : 'سرویس alignment تنظیم نشده است؛ ALIGNMENT_TOKEN_SECRET لازم است.' 
      }, { status: 503 })
    }

    // ✅ ساخت JWT توکن برای احراز هویت
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = base64url(JSON.stringify({ 
      sub: session.user.id, 
      aud: 'promptvault-alignment', 
      iat: now, 
      exp: now + 1800 // ۳۰ دقیقه اعتبار
    }))
    const unsigned = `${header}.${payload}`
    const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')

    console.log('[Alignment Ticket] Service URL:', serviceUrl)
    console.log('[Alignment Ticket] Token issued for user:', session.user.id)

    return NextResponse.json({ 
      serviceUrl, 
      token: `${unsigned}.${signature}` 
    }, { 
      headers: { 'Cache-Control': 'no-store' } 
    })

  } catch (error) {
    console.error('[Alignment Ticket Error]', error)
    return NextResponse.json({ 
      error: 'صدور مجوز موقت alignment انجام نشد.' 
    }, { status: 500 })
  }
}