import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // برای امنیت فقط با این پسورد خروجی بدهد
  if (searchParams.get('token') !== 'my-temp-backup-key-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ARVAN_ACCESS_KEY: process.env.ARVAN_ACCESS_KEY,
    ARVAN_SECRET_KEY: process.env.ARVAN_SECRET_KEY,
    ARVAN_ENDPOINT: process.env.ARVAN_ENDPOINT,
    ARVAN_BUCKET_NAME: process.env.ARVAN_BUCKET_NAME,
    // هر متغیر حساس دیگری که دارید نامش را اینجا اضافه کنید
  });
}