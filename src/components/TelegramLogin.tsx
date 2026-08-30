'use client'

import { useEffect, useRef } from 'react'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramLoginProps {
  botUsername: string
  onAuth: (user: TelegramUser) => void
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  requestAccess?: boolean
}

export default function TelegramLogin({
  botUsername,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 20,
  requestAccess = true,
}: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // پاک کردن محتوای قبلی
    containerRef.current.innerHTML = ''

    // ساخت اسکریپت تلگرام
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-radius', String(cornerRadius))
    script.setAttribute('data-request-access', String(requestAccess))
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.async = true

    // تعریف تابع callback
    ;(window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user)
    }

    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [botUsername, buttonSize, cornerRadius, requestAccess, onAuth])

  return <div ref={containerRef} className="flex justify-center" />
}