'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function TelegramVerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('توکن ورود یافت نشد.')
      return
    }

    let isMounted = true

    async function handleAuth() {
      try {
        const res = await fetch(`/api/auth/telegram/verify?token=${token}`)
        const data = await res.json()

        if (!data.ok || !data.userId) {
          if (isMounted) setError(data.error || 'خطا در اعتبارسنجی توکن.')
          return
        }

        const resSignIn = await signIn('telegram', {
          userId: data.userId,
          redirect: false,
          callbackUrl: '/',
        })

        if (resSignIn?.error) {
          if (isMounted) setError('ایجاد نشست ورود با خطا مواجه شد.')
        } else {
          router.replace('/')
          router.refresh()
        }
      } catch (err) {
        if (isMounted) setError('خطا در برقراری ارتباط با سرور.')
      }
    }

    handleAuth()
    return () => { isMounted = false }
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070605] text-white p-4" dir="rtl">
      <div className="max-w-md w-full bg-[#110f0d] border border-stone-800 rounded-3xl p-8 text-center shadow-2xl">
        {!error ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <h2 className="text-base font-bold">در حال اتصال و ورود به حساب کاربری...</h2>
            <p className="text-xs text-stone-400">لطفاً چند لحظه شکیبا باشید.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-xl font-black">
              ✕
            </div>
            <h2 className="text-base font-bold text-red-400">{error}</h2>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="mt-2 px-6 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-bold hover:bg-stone-700 transition"
            >
              بازگشت به صفحه ورود
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
