'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id?: string
  promptId?: string
  status?: string
  currentStatus?: string
}

export default function PromptActions({ id, promptId, status, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const targetId = promptId || id || ''
  const currentStat = (currentStatus || status || '').toUpperCase()

  const handlePublish = async () => {
    if (loading || !targetId) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, action: 'publish' }),
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
    if (loading || !targetId) return
    if (!confirm('آیا از حذف این پرامپت اطمینان دارید؟')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, action: 'delete' }),
      })
      if (!res.ok) {
        const delRes = await fetch(`/api/admin/prompts?id=${targetId}`, { method: 'DELETE' })
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
      {currentStat !== 'PUBLISHED' && (
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
