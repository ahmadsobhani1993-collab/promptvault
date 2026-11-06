export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { sendPushToSubscriptions } from '@/lib/push-notifications';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    const { title, body, url, target, targetEmail } = await req.json();
    if (typeof title !== 'string' || typeof body !== 'string') {
      return NextResponse.json({ error: 'عنوان و متن اعلان الزامی است.' }, { status: 400 });
    }

    let subscriptions;
    if (target === 'SINGLE' && typeof targetEmail === 'string') {
      subscriptions = await prisma.pushSubscription.findMany({
        where: { user: { email: targetEmail } },
        select: { id: true, endpoint: true, keys: true },
      });
    } else {
      subscriptions = await prisma.pushSubscription.findMany({
        select: { id: true, endpoint: true, keys: true },
      });
    }

    const result = await sendPushToSubscriptions(subscriptions, {
      title,
      body,
      url: url || '/',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Push notification send error:', error);
    return NextResponse.json({ error: 'خطای سرور در ارسال اعلان' }, { status: 500 });
  }
}
