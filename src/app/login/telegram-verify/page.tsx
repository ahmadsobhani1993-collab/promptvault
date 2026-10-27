'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

function VerifyInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (!token) {
      setError('توکن ورود یافت نشد.')
      return
    }

    ;(async () => {
      try {
        const res = await signIn('telegram', {
          token,
          redirect: false,
          callbackUrl: '/',
        })

        if (!res || res.error) {
          setError('توکن نامعتبر یا منقضی شده است. دوباره از طریق ربات وارد شوید.')
          return
        }

        router.replace('/')
        router.refresh()
      } catch {
        setError('خطا در برقراری ارتباط با سرور.')
      }
    })()
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

export default function TelegramVerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  )
}