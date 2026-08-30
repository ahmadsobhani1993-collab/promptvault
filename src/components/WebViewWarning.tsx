'use client'

import { useEffect, useState } from 'react'

export default function WebViewWarning({ children }: { children: React.ReactNode }) {
  const [isWebView, setIsWebView] = useState(false)
  const [attemptingOpen, setAttemptingOpen] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isInstagram = /Instagram/i.test(ua)
    const isTelegram = /Telegram/i.test(ua)
    const isFacebook = /FBAN|FBAV/i.test(ua)
    const isLine = /Line/i.test(ua)
    const isWeChat = /MicroMessenger/i.test(ua)
    const isWebViewGeneral = /wv|WebView/i.test(ua)
    
    if (isInstagram || isTelegram || isFacebook || isLine || isWeChat || isWebViewGeneral) {
      setIsWebView(true)
      
      // تلاش خودکار برای باز کردن در مرورگر بعد از ۱ ثانیه
      setTimeout(() => {
        setAttemptingOpen(true)
      }, 1000)
    }
  }, [])

  const openInBrowser = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href
      // روش ۱: باز کردن در تب جدید
      window.open(url, '_blank')
      
      // روش ۲: تغییر location (اگر _blank کار نکرد)
      setTimeout(() => {
        window.location.href = url
      }, 500)
    }
  }

  if (!isWebView) {
    return <>{children}</>
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🌐</div>
        <h1 className="text-2xl font-bold mb-4">لطفاً در مرورگر باز کنید</h1>
        <p className="mb-6 text-gray-300">
          {attemptingOpen 
            ? 'در حال باز کردن در مرورگر...' 
            : 'برای ورود با گوگل، باید این صفحه را در مرورگر اصلی باز کنید.'}
        </p>

        {/* دکمه اصلی */}
        <button
          onClick={openInBrowser}
          className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg mb-4 transition font-bold text-lg"
        >
          🔗 باز کردن در مرورگر
        </button>

        {/* کپی لینک */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(currentUrl).then(() => {
              alert('لینک کپی شد! در مرورگر paste کنید.')
            })
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg mb-6 transition"
        >
          📋 کپی لینک
        </button>

        {/* راهنماها */}
        {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm">
            <p className="font-bold mb-2">📱 در آیفون:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی آیکون Share (↗) بزنید</li>
              <li>۲. Open in Safari را انتخاب کنید</li>
            </ol>
          </div>
        )}

        {/Android/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm mt-3">
            <p className="font-bold mb-2">📱 در اندروید:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی منوی ⋮ بزنید</li>
              <li>۲. Open in Browser را انتخاب کنید</li>
            </ol>
          </div>
        )}

        {/Telegram/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm mt-3">
            <p className="font-bold mb-2">📱 در تلگرام:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی منوی  در بالا بزنید</li>
              <li>۲. Open in Browser را انتخاب کنید</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}