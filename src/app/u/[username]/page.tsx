import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: 'پروفایل کاربر | PromptsFA' }
}

export default function PublicProfilePage({ params }: { params: { username: string } }) {
  return (
    <section className="container-app py-20">
      <div className="card p-12 text-center">
        <div className="text-6xl mb-6">🚧</div>
        <h1 className="font-display text-2xl font-bold text-gold-bright mb-4">
          این صفحه در حال ساخت است
        </h1>
        <p className="text-ink-muted mb-8">
          به زودی پروفایل عمومی کاربران با امکانات کامل در دسترس خواهد بود
        </p>
        <Link href="/" className="btn-primary inline-block">
          بازگشت به صفحه اصلی
        </Link>
      </div>
    </section>
  )
}
