'use client'

import { useState, useEffect } from 'react'

export default function ImportConsolePage() {
  const [lastId, setLastId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/batch-import')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setLastId(data.currentLastId)
      })
  }, [])

  const handleRunBatch = async () => {
    setLoading(true)
    setMessage('در حال استخراج ۵ پست بعدی و پالایش پرامپت‌ها با Gemini...')
    try {
      const res = await fetch('/api/admin/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 5 }),
      })
      const data = await res.json()
      if (data.ok) {
        setLastId(data.lastId)
        if (data.prompts && data.prompts.length > 0) {
          setLogs((prev) => [...data.prompts, ...prev])
          setMessage(`تعداد ${data.prompts.length} پرامپت جدید با موفقیت ذخیره و منتشر شد.`)
        } else {
          setMessage(data.message || 'پست جدیدی برای ثبت یافت نشد.')
        }
      } else {
        setMessage('خطا: ' + (data.error || 'عملیات ناموفق بود.'))
      }
    } catch (err: any) {
      setMessage('خطای شبکه: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-app py-10 max-w-5xl mx-auto px-4 dir-rtl text-right">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-line pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">کنسول ایمپورت هوشمند از تلگرام</h1>
          <p className="text-sm text-ink-muted mt-1">استخراج ساختاریافته، عنوان‌گذاری صریح بر اساس سئو و پالایش با جمینای</p>
        </div>

        <div className="flex items-center gap-4 bg-surface px-4 py-2 rounded-2xl border border-line">
          <span className="text-xs text-ink-muted">آخرین آیدی ثبت شده:</span>
          <span className="font-mono font-bold text-gold-bright text-base">{lastId ?? '...'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleRunBatch}
          disabled={loading}
          className="btn-primary px-6 py-3 rounded-2xl font-bold flex items-center gap-2 text-sm transition-all"
        >
          {loading ? (
            <>در حال پردازش ۵ پست بعدی...</>
          ) : (
            <>دریافت و پردازش ۵ پرامپت بعدی ⚡</>
          )}
        </button>

        {message && (
          <span className="text-xs font-medium text-gold-bright bg-gold/10 px-3 py-2 rounded-xl border border-gold/20">
            {message}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-ink">پرامپت‌های پردازش‌شده در این نشست:</h2>
        
        {logs.length === 0 ? (
          <div className="card p-12 text-center text-ink-muted border-dashed border-2 border-line">
            هنوز در این سشن دکمه را نزده‌اید. با فشردن دکمه بالا ۵ پست پردازش می‌شوند.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {logs.map((item) => (
              <div key={item.id} className="card p-4 flex gap-4 border border-line hover:border-gold/30 transition-all bg-[#0d0b08]">
                {item.img && (
                  <img src={item.img} alt={item.titleFa} className="w-24 h-24 object-cover rounded-xl border border-line/60 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] bg-gold/20 text-gold-bright px-2 py-0.5 rounded-full font-mono">#{item.telegramId}</span>
                    <a href={`/prompts/${item.slug}`} target="_blank" className="text-xs text-ink-muted hover:text-gold-bright">مشاهده در سایت ↗</a>
                  </div>
                  <h3 className="text-sm font-bold text-ink line-clamp-1">{item.titleFa}</h3>
                  <p className="text-xs text-ink-muted mt-1 line-clamp-2">{item.descFa}</p>
                  <p className="text-[11px] font-mono text-zinc-400 mt-2 line-clamp-2 bg-surface/50 p-1.5 rounded-lg border border-line/30 dir-ltr text-left">
                    {item.promptEn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
