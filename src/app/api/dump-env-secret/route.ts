import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  if (searchParams.get('token') !== 'my-temp-backup-key-2026') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // متغیرهای شناسایی‌شده از پنل ورسل
  const envKeys = [
    'VAPID_PRIVATE_KEY',
    'TELEGRAM_WEBHOOK_SECRET',
    'ARVAN_BUCKET',
    'ARVAN_ENDPOINT',
    'ARVAN_SECRET_KEY',
    'ARVAN_ACCESS_KEY',
    'AUTH_GOOGLE_SECRET',
    'AUTH_GOOGLE_ID',
    'AUTG_GOOGLE_ID',
    'VAPID_SUBJECT',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'GEMINI_API_KEY_3',
    'GEMINI_API_KEY_2',
    'GEMINI_API_KEY_1',
    'GEMINI_API_KEY',
    'TELEGRAM_OUTPUT',
    'NEXT_PUBLIC_APP_URL',
    'TELEGRAM_BOT_USERNAME',
    'AUTH_URL',
    'NEXTAUTH_URL',
    'TELEGRAM_READ_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'LOGIN_BOT_TOKEN',
    'DIRECT_URL',
    'CRON_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_API_KEY',
    'AUTH_SECRET'
  ];

  let output = `# --- Environment Variables Exported from Vercel ---\n`;
  output += `DATABASE_URL="postgresql://postgres:StrongServerPassword123!@db:5432/promptvault?schema=public"\n`;

  for (const key of envKeys) {
    const val = process.env[key];
    if (val !== undefined) {
      output += `${key}="${val}"\n`;
    }
  }

  return new NextResponse(output, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}