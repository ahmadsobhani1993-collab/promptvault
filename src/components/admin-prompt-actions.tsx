'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PromptActionsProps {
  promptId: string
  status?: string
  currentStatus?: string
  locale?: string
}

export default function PromptActions({
  promptId,
  status,
  currentStatus,
  locale = 'fa'
}: PromptActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const actualStatus = (currentStatus || status || '').toUpperCase()

  const handlePublish = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, action: 'publish' }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      alert('خطا در انتشار پرامپت')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (loading) return
    if (!confirm('آیا از حذف کامل این پرامپت مطمئن هستید؟')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, action: 'delete' }),
      })
      if (!res.ok) {
        const delRes = await fetch(`/api/admin/prompts?id=${promptId}`, { method: 'DELETE' })
        if (!delRes.ok) throw new Error()
      }
      router.refresh()
    } catch {
      alert('خطا در حذف پرامپت')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {actualStatus !== 'PUBLISHED' && (
        <button
          onClick={handlePublish}
          disabled={loading}
          className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
        >
          انتشار
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
      >
        حذف
      </button>
    </div>
  )
}
