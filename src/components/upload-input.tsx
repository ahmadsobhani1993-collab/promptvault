'use client'

import { useRef, useState } from 'react'

export default function UploadInput({ label, tooBigMsg }: { label: string; tooBigMsg: string }) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr('')
    if (f.size > 1_000_000) { setErr(tooBigMsg); return }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      setPreview(String(reader.result))
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: reader.result }),
        })
        const j = await res.json()
        if (!res.ok) { setErr(j.tooBig ? tooBigMsg : (j.error ?? 'خطا')); setPreview(''); }
        else setUrl(j.url)
      } catch {
        setErr('خطا در آپلود')
        setPreview('')
      }
      setBusy(false)
    }
    reader.readAsDataURL(f)
  }

  return (
    <div>
      <input type="hidden" name="img" value={url} required />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-elevated/50 px-5 py-6 text-sm text-ink-muted transition-colors hover:border-gold"
      >
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <span className="text-2xl">🖼</span>
        )}
        <span>{busy ? 'در حال آپلود...' : preview ? 'تغییر تصویر ✅' : label}</span>
      </button>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
    </div>
  )
}
