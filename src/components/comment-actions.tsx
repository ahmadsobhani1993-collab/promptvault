'use client'

import { useRouter } from 'next/navigation'

export default function CommentActions({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'delete' }) })
        router.refresh()
      }}
      className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/25"
    >
      حذف
    </button>
  )
}
