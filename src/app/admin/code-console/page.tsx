'use client'

import { useState } from 'react'

export default function CodeConsole() {
  const [text, setText] = useState('')
  const [type, setType] = useState<'code' | 'audio'>('code')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    setLoading(true)
    setStatus('در حال پردازش...')
    try {
      let parsed = []
      if (text.trim().startsWith('[')) {
        parsed = JSON.parse(text)
      } else {
        parsed = text.split('\n---\n').map((chunk, idx) => ({
          title: `پرامپت ${type === 'code' ? 'کدنویسی' : 'موزیک'} ${idx + 1}`,
          prompt: chunk.trim()
        })).filter(x => x.prompt.length > 0)
      }

      const res = await fetch('/api/admin/bulk-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed, type }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus(`تعداد ${data.count} پرامپت با پوستر اختصاصی ساخته شد!`)
        setText('')
      } else {
        setStatus(`خطا: ${data.error}`)
      }
    } catch (e: any) {
      setStatus(`خطا در پردازش ورودی: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container-app py-12 max-w-4xl">
      <h1 className="text-2xl font-bold text-gold-bright mb-4">کنسول ورود دسته‌جمعی پرامپت‌ها</h1>
      <p className="text-sm text-ink-muted mb-6">کدها یا متن‌ها را با جداکننده خطی (---) یا آرایه JSON وارد کنید. کاور اختصاصی گرافیکی به صورت خودکار برای هرکدام ساخته می‌شود.</p>

      <div className="flex gap-4 mb-4">
        <button
          type="button"
          onClick={() => setType('code')}
          className={`px-4 py-2 rounded-xl border text-sm font-medium ${type === 'code' ? 'border-gold bg-gold/20 text-gold-bright' : 'border-line text-ink-muted'}`}
        >
          پرامپت‌های کد و اسکریپت
        </button>
        <button
          type="button"
          onClick={() => setType('audio')}
          className={`px-4 py-2 rounded-xl border text-sm font-medium ${type === 'audio' ? 'border-gold bg-gold/20 text-gold-bright' : 'border-line text-ink-muted'}`}
        >
          پرامپت‌های صوتی و موسیقی
        </button>
      </div>

      <textarea
        rows={15}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={type === 'code' ? "کد اول\n---\nکد دوم\n---\nکد سوم" : '[{"title": "نام آهنگ", "prompt": "متن پرامپت"}]'}
        className="input font-mono text-xs w-full bg-[#0B0B0D] p-4 rounded-xl border border-line"
      />

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !text.trim()}
          className="btn-primary"
        >
          {loading ? 'در حال ایجاد...' : 'شروع ایمپورت خودکار'}
        </button>
        {status && <span className="text-sm text-gold-deep">{status}</span>}
      </div>
    </section>
  )
}