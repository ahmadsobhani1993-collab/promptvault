'use client'

import { useEffect, useState } from 'react'

export default function WebViewWarning({ children }: { children: React.ReactNode }) {
  const [isWebView, setIsWebView] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isInstagram = /Instagram/i.test(ua)
    const isTelegram = /Telegram/i.test(ua)
    const isFacebook = /FBAN|FBAV/i.test(ua)
    
    if (isInstagram || isTelegram || isFacebook || /wv|WebView/i.test(ua)) {
      setIsWebView(true)
      
      // تلاش خودکار برای باز کردن بعد از ۳ ثانیه
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            // روش ۱: replace (بهترین شانس)
            window.location.replace(window.location.href)
            
            // روش ۲: assign (اگر replace کار نکرد)
            setTimeout(() => {
              window.location.assign(window.location.href)
            }, 1000)
            
            // روش ۳: href (اگر دو روش قبل کار نکرد)
            setTimeout(() => {
              window.location.href = window.location.href
            }, 2000)
            
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [])

  if (!isWebView) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6"></div>
        <h1 className="text-2xl font-bold mb-4">در حال انتقال به مرورگر...</h1>
        <p className="mb-6 text-gray-300">
          {countdown > 0 
            ? `اگر منتقل نشد، در ${countdown} ثانیه تلاش می‌کنیم...` 
            : 'اگر باز نشد، روی دکمه زیر بزنید:'}
        </p>

        <button
          onClick={() => {
            const url = window.location.href
            window.open(url, '_blank')
            setTimeout(() => {
              window.location.href = url
            }, 500)
          }}
          className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg mb-4 transition font-bold"
        >
          🔗 باز کردن در مرورگر
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              alert('لینک کپی شد! در مرورگر paste کنید.')
            })
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
        >
          📋 کپی لینک
        </button>

        <div className="mt-6 text-sm text-gray-400">
          <p>اگر هیچ‌کدام کار نکرد:</p>
          <p>روی منوی  بزنید → Open in Browser</p>
        </div>
      </div>
    </div>
  )
}