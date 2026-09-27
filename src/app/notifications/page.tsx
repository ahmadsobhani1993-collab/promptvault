import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-ink-muted">لطفاً ابتدا وارد شوید</p>
      </div>
    )
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <section className="container-app py-10">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-gold-bright mb-6">اعلان‌ها</h1>
        {notifications.length === 0 ? (
          <p className="text-center text-ink-muted py-12">اعلانی وجود ندارد</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-line/60 bg-surface/50 p-4">
                <div className="text-sm font-bold text-ink">{n.text}</div>
                <div className="mt-1 text-[10px] text-ink-muted">
                  {new Date(n.createdAt).toLocaleDateString('fa-IR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
