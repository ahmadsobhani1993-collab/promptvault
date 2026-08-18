'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [permission, setPermission] = useState<string>('default')

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const handler = (e: any) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return (
    <div className="container-app flex flex-wrap items-center justify-center gap-3 pb-10">
      {installEvt && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            installEvt.prompt?.()
            setInstallEvt(null)
          }}
        >
          📲 نصب اپ
        </button>
      )}
      
    </div>
  )
}
