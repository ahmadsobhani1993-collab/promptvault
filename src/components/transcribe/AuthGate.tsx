import Link from 'next/link'

export default function AuthGate() {
  return (
    <div className="container-app mx-auto max-w-3xl p-6" dir="rtl">
      <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
        <p className="text-sm text-ink-muted">
          برای استفاده از این بخش، ابتدا باید وارد حساب کاربری خود شوید.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl border border-amber-500/60 px-6 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10"
        >
          ورود به حساب کاربری
        </Link>
      </div>
    </div>
  )
}
