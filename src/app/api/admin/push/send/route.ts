export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@promptsfa.ir';

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'کلیدهای VAPID در متغیرهای محیطی سرور تنظیم نشده‌اند.' },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { title, body, url, target, targetEmail } = await req.json();

    let subscriptions: any[] = [];

    if (target === 'SINGLE' && targetEmail) {
      subscriptions = await prisma.pushSubscription.findMany({
        where: { user: { email: targetEmail } },
      });
    } else {
      subscriptions = await prisma.pushSubscription.findMany();
    }

    let deliveredCount = 0;
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/icons/icon-192.png',
    });

    for (const sub of subscriptions) {
      try {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: JSON.parse(sub.keys),
        };
        await webpush.sendNotification(pushConfig, payload);
        deliveredCount++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return NextResponse.json({ success: true, deliveredCount });
  } catch (error) {
    console.error('Push notification send error:', error);
    return NextResponse.json({ error: 'خطای سرور در ارسال اعلان' }, { status: 500 });
  }
}
