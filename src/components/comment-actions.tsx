'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CommentActions({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('آیا از حذف این کامنت اطمینان دارید؟')) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('خطا در حذف کامنت')
      }
    } catch {
      alert('خطا در برقراری ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg bg-red-500/15 px-3 py-1.5 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
    >
      {loading ? 'در حال حذف...' : 'حذف'}
    </button>
  )
}
