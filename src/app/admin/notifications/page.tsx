'use client'

import { useState } from 'react'

export default function AdminNotificationPanel() {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    url: '/',
    target: 'ALL',
    targetEmail: '',
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(`اعلان با موفقیت به ${data.deliveredCount || 0} دستگاه ارسال شد.`)
        setFormData({ title: '', body: '', url: '/', target: 'ALL', targetEmail: '' })
      } else {
        setResult(`خطا در ارسال: ${data.error || 'مشکلی پیش آمد'}`)
      }
    } catch {
      setResult('خطا در برقراری ارتباط با سرور')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container-app py-10 max-w-2xl">
      <div className="card border-gold/40 bg-[#12100d] p-6 md:p-8">
        <div className="flex items-center gap-3 border-b border-line pb-4 mb-6">
          <span className="text-2xl">📢</span>
          <div>
            <h1 className="font-display text-lg font-bold text-gold-bright">پنل ارسال پوش نوتیفیکیشن</h1>
            <p className="text-xs text-ink-muted">ارسال مستقیم پیام به اعضای وب‌اپلیکیشن</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-ink-muted mb-1 font-bold">عنوان اعلان</label>
            <input
              type="text"
              required
              placeholder="مثال: پرامپت ویدیویی جدید اضافه شد! 🔥"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-muted mb-1 font-bold">متن پیام</label>
            <textarea
              required
              rows={3}
              placeholder="متن کامل پیامی که روی صفحه نمایش کاربر نشان داده می‌شود..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-muted mb-1 font-bold">لینک مقصد با کلیک روی پیام (URL)</label>
            <input
              type="text"
              placeholder="/prompts/..."
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-muted mb-1 font-bold">جامعه هدف</label>
            <select
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
            >
              <option value="ALL">همه کاربران ثبت‌شده (همگانی)</option>
              <option value="SINGLE">ارسال اختصاصی به یک کاربر</option>
            </select>
          </div>

          {formData.target === 'SINGLE' && (
            <div>
              <label className="block text-xs text-ink-muted mb-1 font-bold">ایمیل کاربر مقصد</label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={formData.targetEmail}
                onChange={(e) => setFormData({ ...formData, targetEmail: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none dir-ltr text-left"
              />
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg border border-gold/30 bg-gold/10 text-xs text-gold-bright">
              {result}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="btn-primary w-full py-3 rounded-xl font-bold text-xs"
          >
            {sending ? 'در حال مخابره پیام...' : '🚀 ارسال فوری نوتیفیکیشن'}
          </button>
        </form>
      </div>
    </div>
  )
}
