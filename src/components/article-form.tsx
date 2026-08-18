'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import MarkdownEditor from '@/components/markdown-editor'

export default function ArticleForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async (e: any) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.target)
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
    if (j.ok) router.push('/admin/articles')
    else {
      setMsg(j.error ?? 'خطا')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
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
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (هر خط = یک پاراگراف؛ ## برای زیرعنوان)</label>
        <MarkdownEditor name="contentFa" />
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
      <button disabled={busy} className="btn-primary w-full justify-center">{busy ? 'در حال انتشار...' : ' انتشار مقاله'}</button>
    </form>
  )
}
