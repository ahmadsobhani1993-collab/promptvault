'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [installable, setInstallable] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)

    const handler = (e: any) => {
      e.preventDefault()
      setInstallable(true)
      ;(window as any).deferredPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    const prompt = (window as any).deferredPrompt
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setInstallable(false)
  }

  const enableNotifications = async () => {
    if (permission === 'denied') {
      alert('لطفاً در تنظیمات مرورگر، نوتیفیکیشن را مجاز کن.')
      return
    }
    setNotifying(true)
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await getVapidPublicKey(),
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      alert('✅ نوتیفیکیشن فعال شد!')
    }
    setNotifying(false)
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-xs text-success">
        <span>✅ نوتیفیکیشن فعال</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {installable && (
        <button type="button" onClick={install} className="btn-secondary text-xs">
          📲 نصب اپ
        </button>
      )}
      <button type="button" onClick={enableNotifications} disabled={notifying} className="btn-secondary text-xs">
        {notifying ? '...' : '🔔 فعال‌سازی نوتیفیکیشن'}
      </button>
    </div>
  )
}

async function getVapidPublicKey(): Promise<Uint8Array> {
  const res = await fetch('/api/push/vapid-key')
  const { publicKey } = await res.json()
  return urlBase64ToUint8Array(publicKey)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
