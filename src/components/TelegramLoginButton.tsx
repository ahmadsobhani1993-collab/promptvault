'use client'

import { useRouter } from 'next/navigation'
import TelegramLogin from './TelegramLogin'

export default function TelegramLoginButton() {
  const router = useRouter()

  const handleAuth = async (user: any) => {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        alert('خطا در ورود با تلگرام')
      }
    } catch (error) {
      alert('خطا در اتصال به سرور')
    }
  }

  return (
    <TelegramLogin
      botUsername="telegramloginbot"
      onAuth={handleAuth}
    />
  )
}
