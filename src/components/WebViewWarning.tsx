'use client'

import { useEffect, useState } from 'react'

export default function WebViewWarning({ children }: { children: React.ReactNode }) {
  const [isWebView, setIsWebView] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isInstagram = /Instagram/i.test(ua)
    const isTelegram = /Telegram/i.test(ua)
    const isFacebook = /FBAN|FBAV/i.test(ua)
    const isLine = /Line/i.test(ua)
    const isWeChat = /MicroMessenger/i.test(ua)
    
    // تشخیص کلی WebView
    const isWebViewGeneral = 
      (ua.includes('wv') || ua.includes('WebView')) &&
      !ua.includes('Chrome/') ||
      (ua.includes('Android') && !ua.includes('Chrome/'))
    
    if (isInstagram || isTelegram || isFacebook || isLine || isWeChat || isWebViewGeneral) {
      setIsWebView(true)
    }
  }, [])

  if (!isWebView) {
    return <>{children}</>
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🌐</div>
        <h1 className="text-2xl font-bold mb-4">برای ورود، لطفاً در مرورگر باز کنید</h1>
        <p className="mb-8 text-gray-300 leading-relaxed">
          ورود با گوگل در این برنامه پشتیبانی نمی‌شود.
          <br />
          لطفاً این صفحه را در مرورگر اصلی دستگاه خود باز کنید.
        </p>

        {/* دکمه کپی لینک */}
        <button
          onClick={copyLink}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg mb-3 transition font-medium"
        >
          {copied ? '✓ کپی شد!' : '📋 کپی لینک'}
        </button>

        {/* دکمه باز کردن در مرورگر */}
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg mb-6 transition font-medium"
        >
          🔗 باز کردن در مرورگر
        </a>

        {/* راهنمای iOS */}
        {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm text-gray-300">
            <p className="font-bold text-white mb-2">📱 در آیفون:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی آیکون <span className="text-blue-400">Share</span> (↗) در پایین بزنید</li>
              <li>۲. <span className="text-blue-400">Open in Safari</span> را انتخاب کنید</li>
            </ol>
          </div>
        )}

        {/* راهنمای Android */}
        {/Android/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm text-gray-300">
            <p className="font-bold text-white mb-2">📱 در اندروید:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی منوی <span className="text-blue-400">⋮</span> (سه نقطه) بزنید</li>
              <li>۲. <span className="text-blue-400">Open in Browser</span> را انتخاب کنید</li>
            </ol>
          </div>
        )}

        {/* راهنمای تلگرام */}
        {/Telegram/i.test(navigator.userAgent) && (
          <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-sm text-gray-300 mt-3">
            <p className="font-bold text-white mb-2">️ در تلگرام:</p>
            <ol className="space-y-1 text-right">
              <li>۱. روی منوی <span className="text-blue-400">⋮</span> در بالا بزنید</li>
              <li>۲. <span className="text-blue-400">Open in Browser</span> را انتخاب کنید</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}