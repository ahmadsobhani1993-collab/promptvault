'use client'

import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setIsSubscribed(true)
        })
      })
    }
  }, [])

  const subscribeUser = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('لطفاً دسترسی اعلان را در مرورگر تأیید کنید.')
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        alert('کلید VAPID تعریف نشده است.')
        return
      }

      const convertedKey = urlBase64ToUint8Array(vapidKey)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })

      if (res.ok) {
        setIsSubscribed(true)
        alert('اعلان‌های سیستم با موفقیت فعال شدند!')
      }
    } catch (err) {
      console.error(err)
      alert('خطا در همگام‌سازی نوتیفیکیشن.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-muted hover:border-gold/50 hover:text-gold-bright transition-all"
      >
        <span className="text-base">🔔</span>
        {isSubscribed && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-gold/40 bg-[#12100d] p-4 shadow-2xl z-50 text-right">
          <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
            <span className="text-xs font-bold text-gold-bright">اعلان‌های سیستم</span>
            <span className="text-[10px] text-ink-muted">
              {isSubscribed ? 'وضعیت: متصل' : 'وضعیت: غیرفعال'}
            </span>
          </div>

          {!isSubscribed ? (
            <button
              onClick={subscribeUser}
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold"
            >
              {loading ? 'در حال اتصال...' : '🔔 فعال‌سازی نوتیفیکیشن فوری'}
            </button>
          ) : (
            <div className="text-center py-4">
              <span className="text-2xl">✨</span>
              <p className="mt-2 text-xs text-emerald-400 font-bold">دستگاه شما متصل است</p>
              <p className="mt-1 text-[11px] text-ink-muted">اعلان‌های جدید بلافاصله حتی در زمان بسته بودن سایت روی صفحه ظاهر می‌شوند.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
