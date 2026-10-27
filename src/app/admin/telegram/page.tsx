'use client'

import { useEffect, useRef, useState } from 'react'

type Stats = { scanned: number; sent: number; unreachable: number; failed: number }
const ZERO: Stats = { scanned: 0, sent: 0, unreachable: 0, failed: 0 }
const MAX_TEXT = 4096

async function callApi(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/telegram-broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json().catch(() => ({ ok: false, error: 'پاسخ نامعتبر از سرور' }))
}

export default function AdminTelegramPage() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(false)
  const [single, setSingle] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  const [hasToken, setHasToken] = useState(true)
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<Stats>(ZERO)
  const [msg, setMsg] = useState<string | null>(null)
  const [resumeCursor, setResumeCursor] = useState<string | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    fetch('/api/admin/telegram-broadcast')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setTotal(d.recipients ?? 0)
        setHasToken(!!d.hasToken)
      })
      .catch(() => {})
  }, [])

  const textOk = text.trim().length > 0 && text.length <= MAX_TEXT

  async function sendTest() {
    setMsg(null)
    const r = await callApi({ mode: 'test', text, preview })
    setMsg(r.ok ? 'پیام تست به تلگرام تو ارسال شد.' : `ناموفق: ${r.error || r.result || 'نامشخص'}`)
  }

  async function sendSingle() {
    setMsg(null)
    const r = await callApi({ mode: 'single', text, preview, target: single.trim() })
    setMsg(r.ok ? 'پیام ارسال شد.' : `ناموفق: ${r.error || r.result || 'نامشخص'}`)
  }

  async function runBroadcast(from: string | null) {
    if (!from) {
      const ok = confirm(`این پیام برای حدود ${total ?? '?'} کاربر ارسال می‌شود. مطمئنی؟`)
      if (!ok) return
      setStats(ZERO)
    }

    stopRef.current = false
    setRunning(true)
    setMsg(null)
    setResumeCursor(null)

    let cursor: string | null = from
    let acc: Stats = from ? { ...stats } : { ...ZERO }

    try {
      while (!stopRef.current) {
        const r = await callApi({ mode: 'broadcast', text, preview, cursor })
        if (!r.ok) {
          setMsg(`خطا: ${r.error || 'نامشخص'}`)
          setResumeCursor(cursor)
          break
        }

        acc = {
          scanned: acc.scanned + (r.scanned || 0),
          sent: acc.sent + (r.sent || 0),
          unreachable: acc.unreachable + (r.unreachable || 0),
          failed: acc.failed + (r.failed || 0),
        }
        setStats(acc)
        cursor = r.nextCursor

        if (r.done) {
          setMsg('ارسال همگانی کامل شد.')
          break
        }
        // ~20 messages per batch + pause keeps us well under Telegram's 30 msg/sec limit
        await new Promise((res) => setTimeout(res, 1100))
      }

      if (stopRef.current) {
        setMsg('ارسال متوقف شد. می‌توانی از همان‌جا ادامه بدهی.')
        setResumeCursor(cursor)
      }
    } catch {
      setMsg('خطای شبکه. می‌توانی از همان‌جا ادامه بدهی.')
      setResumeCursor(cursor)
    } finally {
      setRunning(false)
    }
  }

  const progress = total ? Math.min(100, Math.round((stats.scanned / total) * 100)) : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4" dir="rtl">
      <h1 className="text-xl font-bold">ارسال پیام به کاربران ربات تلگرام</h1>

      {!hasToken && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          متغیر TELEGRAM_BOT_TOKEN در سرور تنظیم نشده است.
        </div>
      )}

      <div className="rounded-xl border border-line bg-elevated p-4 text-sm text-ink-muted">
        کاربران دارای شناسهٔ تلگرام: <strong className="text-ink">{total ?? '...'}</strong>
        <p className="mt-1 text-xs">
          کاربری که ربات را بلاک کرده یا هیچ‌وقت شروع نکرده باشد در آمار «غیرقابل‌دسترس» می‌آید.
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={MAX_TEXT}
          placeholder="متن پیام..."
          className="w-full rounded-2xl border border-line bg-surface/50 p-3.5 text-sm text-ink focus:border-gold focus:outline-none"
        />
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
            نمایش پیش‌نمایش لینک
          </label>
          <span>
            {text.length} / {MAX_TEXT}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={!textOk || running}
          className="rounded-xl border border-gold/40 px-4 py-2 text-xs font-bold text-gold-bright disabled:opacity-40"
        >
          ارسال تست به خودم
        </button>

        <button
          type="button"
          onClick={() => runBroadcast(null)}
          disabled={!textOk || running || !hasToken}
          className="btn-primary rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-40"
        >
          ارسال همگانی
        </button>

        {running && (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true
            }}
            className="rounded-xl border border-red-500/50 px-4 py-2 text-xs font-bold text-red-300"
          >
            توقف
          </button>
        )}

        {!running && resumeCursor && (
          <button
            type="button"
            onClick={() => runBroadcast(resumeCursor)}
            className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink"
          >
            ادامه از جایی که متوقف شد
          </button>
        )}
      </div>

      {(running || stats.scanned > 0) && (
        <div className="space-y-2 rounded-xl border border-line bg-elevated p-4 text-sm">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gold-bright transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
            <span>بررسی‌شده: {stats.scanned}</span>
            <span className="text-green-400">ارسال‌شده: {stats.sent}</span>
            <span className="text-yellow-400">غیرقابل‌دسترس: {stats.unreachable}</span>
            <span className="text-red-400">ناموفق: {stats.failed}</span>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-ink">{msg}</p>}

      <div className="space-y-2 border-t border-line/60 pt-5">
        <h2 className="text-sm font-bold">ارسال به یک نفر</h2>
        <div className="flex gap-2">
          <input
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            placeholder="شناسهٔ عددی تلگرام"
            className="flex-1 rounded-xl border border-line bg-surface/50 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={sendSingle}
            disabled={!textOk || running || !/^\d{5,15}$/.test(single.trim())}
            className="rounded-xl border border-gold/40 px-4 py-2 text-xs font-bold text-gold-bright disabled:opacity-40"
          >
            ارسال
          </button>
        </div>
      </div>
    </div>
  )
}