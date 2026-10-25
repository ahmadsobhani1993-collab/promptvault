'use client'

import { useState } from 'react'

export default function TelegramLoginButton() {
  const [loading, setLoading] = useState(false)
  const [directUrl, setDirectUrl] = useState<string | null>(null)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/telegram/init', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()

      if (data.url) {
        setDirectUrl(data.url)
        window.location.href = data.url
      } else {
        alert(data.error || 'خطا در ساخت لینک ورود')
        setLoading(false)
      }
    } catch {
      alert('خطا در برقراری ارتباط با سرور. لطفاً مجدداً امتحان کنید.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-primary w-full justify-center text-sm font-bold active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin text-black" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            در حال انتقال به تلگرام…
          </span>
        ) : (
          'ورود با تلگرام'
        )}
      </button>

      {directUrl && (
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-xs text-gold-bright underline mt-2 py-1"
        >
          اگر تلگرام خودکار باز نشد، اینجا کلیک کنید
        </a>
      )}
    </div>
  )
}
