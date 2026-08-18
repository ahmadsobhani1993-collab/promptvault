'use client'

import { useRouter } from 'next/navigation'

export default function ArticleActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const act = async (action: string) => {
    await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    router.refresh()
  }
  return (
    <div className="flex shrink-0 gap-2">
      {status !== 'PUBLISHED' && (
        <button onClick={() => act('publish')} className="rounded-full bg-green-500/15 px-3 py-1 text-[10px] text-green-400 transition-colors hover:bg-green-500/25">✅ انتشار</button>
      )}
      {status === 'PUBLISHED' && (
        <button onClick={() => act('unpublish')} className="rounded-full bg-yellow-500/15 px-3 py-1 text-[10px] text-yellow-400 transition-colors hover:bg-yellow-500/25">توقف</button>
      )}
      <button onClick={() => act('delete')} className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/25">حذف</button>
    </div>
  )
}
