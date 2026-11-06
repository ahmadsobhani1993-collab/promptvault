export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await req.json();
    if (
      typeof subscription?.endpoint !== 'string' ||
      typeof subscription?.keys?.p256dh !== 'string' ||
      typeof subscription?.keys?.auth !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: JSON.stringify(subscription.keys),
        userId: session.user.id,
      },
      create: {
        endpoint: subscription.endpoint,
        keys: JSON.stringify(subscription.keys),
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}