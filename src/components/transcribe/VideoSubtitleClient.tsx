'use client'
import { useAuth } from '@/lib/use-auth'
import SubtitleEditor from './SubtitleEditor'

export default function VideoSubtitleClient() {
  const auth = useAuth()

  if (auth === 'checking') return <div className="p-10 text-center text-white/40">در حال بررسی…</div>
  if (auth === 'no') return (
    <div className="container-app mx-auto max-w-3xl p-6" dir="rtl">
      <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
        <p className="text-sm text-stone-300">برای استفاده از این بخش، ابتدا باید وارد حساب کاربری خود شوید.</p>
        <a href="/login" className="inline-block rounded-xl border border-amber-500/60 bg-amber-500/10 px-6 py-2.5 text-sm font-bold text-amber-400 transition hover:bg-amber-500/20">
          ورود به حساب کاربری
        </a>
      </div>
    </div>
  )

  return <SubtitleEditor />
}
