'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PromptItem = {
  id: string
  titleFa: string
  titleEn?: string | null
  prompt: string
  descFa?: string | null
  usageFa?: string | null
  model?: string | null
}

export default function EditPromptModal({ prompt }: { prompt: PromptItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    titleFa: prompt.titleFa || '',
    titleEn: prompt.titleEn || '',
    prompt: prompt.prompt || '',
    descFa: prompt.descFa || '',
    usageFa: prompt.usageFa || '',
    model: prompt.model || 'AI',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/user/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prompt.id, ...formData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ذخیره تغییرات')

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'مشکلی رخ داد')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright"
        title="ویرایش پرامپت"
      >
        ✏️ ویرایش
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto border-gold/30 bg-[#12100d] p-6 text-right shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-lg font-bold text-gold-bright">ویرایش پرامپت</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">عنوان فارسی</label>
                <input
                  type="text"
                  value={formData.titleFa}
                  onChange={(e) => setFormData({ ...formData, titleFa: e.target.value })}
                  required
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-muted">عنوان انگلیسی</label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.titleEn}
                  onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-muted">متن پرامپت</label>
                <textarea
                  rows={5}
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  required
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-muted">توضیحات کوتاه</label>
                <input
                  type="text"
                  value={formData.descFa}
                  onChange={(e) => setFormData({ ...formData, descFa: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-muted">مدل هوش مصنوعی</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-4 py-2 text-xs text-ink-muted hover:bg-surface"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
