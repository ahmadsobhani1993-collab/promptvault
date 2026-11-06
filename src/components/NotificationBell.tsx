'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}

export default function NotificationBell() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) return

        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        })
        if (!response.ok) throw new Error(`Subscription sync failed (${response.status})`)
        setIsSubscribed(true)
      })
      .catch((error) => console.error('[Push] Failed to check or sync browser subscription:', error))
  }, [])

  const subscribeUser = async () => {
    setLoading(true)
    setMessage('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('این مرورگر از اعلان فوری پشتیبانی نمی‌کند.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('اجازهٔ نمایش اعلان در مرورگر داده نشد.')

      const [registration, keyResponse] = await Promise.all([
        navigator.serviceWorker.register('/sw.js'),
        fetch('/api/push/vapid-key', { cache: 'no-store' }),
      ])
      const keyData = await keyResponse.json()
      if (!keyResponse.ok || typeof keyData.publicKey !== 'string') {
        throw new Error(keyData.error || 'کلید ثبت اعلان دریافت نشد.')
      }

      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        })

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ثبت دستگاه برای دریافت اعلان انجام نشد.')

      setIsSubscribed(true)
      setMessage('اعلان‌های فوری این دستگاه فعال شد.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'فعال‌سازی اعلان انجام نشد.'
      console.error('[Push] Subscription failed:', error)
      setMessage(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {isSubscribed ? (
        <p className="text-center text-[11px] text-emerald-400">اعلان فوری این دستگاه فعال است.</p>
      ) : (
        <button
          type="button"
          onClick={subscribeUser}
          disabled={loading}
          className="btn-primary w-full rounded-xl py-2 text-xs font-bold disabled:opacity-60"
        >
          {loading ? 'در حال فعال‌سازی...' : 'فعال‌سازی اعلان فوری مرورگر'}
        </button>
      )}
      {message && <p role="status" className="mt-2 text-center text-[11px] text-ink-muted">{message}</p>}
    </div>
  )
}
