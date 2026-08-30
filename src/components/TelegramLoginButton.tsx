'use client'

import { useState } from 'react'

export default function TelegramLoginButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/telegram/init', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        // انتقال به بات تلگرام با توکن
        window.location.href = data.url
      } else {
        alert('خطا در ساخت لینک ورود')
        setLoading(false)
      }
    } catch (error) {
      alert('خطا در اتصال به سرور')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="btn-primary w-full justify-center disabled:opacity-50"
    >
      {loading ? 'در حال انتقال به تلگرام…' : 'ورود با تلگرام'}
    </button>
  )
}
