#!/bin/bash
set -e

# ---------- 1) Complete rewrite of article-form.tsx ----------
cat > src/components/article-form.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import RichTextEditor from '@/components/rich-text-editor'

export default function ArticleForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    
    // Ensure rich text content is synced
    const editor = formRef.current?.querySelector('[contenteditable]') as HTMLDivElement
    const textarea = formRef.current?.querySelector('textarea[name="contentFa"]') as HTMLTextAreaElement
    if (editor && textarea) {
      textarea.value = editor.innerHTML
    }
    
    const fd = new FormData(e.currentTarget)
    
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          titleFa: fd.get('titleFa'),
          descFa: fd.get('descFa'),
          contentFa: fd.get('contentFa'),
          img: fd.get('img'),
          tagFa: fd.get('tagFa'),
        }),
      })
      const j = await res.json()
      if (j.ok) {
        router.push('/admin/articles')
      } else {
        setMsg(j.error ?? 'خطا')
        setBusy(false)
      }
    } catch (err) {
      setMsg('خطا در ارتباط با سرور')
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="mb-1 block text-xs text-ink-muted">عنوان *</label>
        <input name="titleFa" required className="input text-sm" placeholder="عنوان مقاله" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">توضیح متا (سئو)</label>
        <input name="descFa" className="input text-sm" placeholder="۱۵۵ کاراکتر..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">کلمه کلیدی</label>
          <input name="tagFa" className="input text-sm" placeholder="مثلاً: پرامپت نویسی" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">آدرس تصویر کاور (اختیاری)</label>
          <input name="img" className="input text-sm" dir="ltr" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (می‌توانید از ورد کپی کنید)</label>
        <RichTextEditor name="contentFa" />
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
      <button disabled={busy} className="btn-primary w-full justify-center">{busy ? 'در حال انتشار...' : '📤 انتشار مقاله'}</button>
    </form>
  )
}
EOF
echo "✅ Article form: complete rewrite with RichTextEditor"

# ---------- 2) PWA button: small, bottom-right, non-blocking ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return
      }

      const handler = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
      }

      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    } else {
      alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"')
    }
  }

  if (isInstalled || !deferredPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-gold/90 px-3 py-1.5 text-[10px] font-bold text-black shadow-lg transition-all hover:scale-105 active:scale-95"
      title="نصب اپلیکیشن"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span className="hidden sm:inline">نصب اپ</span>
    </button>
  )
}
EOF
echo "✅ PWA button: bottom-right, small"

echo "✅ update131 done!"