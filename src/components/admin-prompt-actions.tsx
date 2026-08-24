'use client'

import { useRouter } from 'next/navigation'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'

export default function PromptActions({ 
  promptId, 
  status, 
  locale 
}: { 
  promptId: string
  status: string
  locale: Locale
}) {
  const router = useRouter()

  const handlePublish = async () => {
    try {
      await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, action: 'publish' }),
      })
      router.push('/admin/prompts')
      router.refresh()
    } catch (err) {
      console.error('Publish error:', err)
      alert(locale === 'fa' ? 'خطا در انتشار' : 'Publish failed')
    }
  }

  const handleReject = async () => {
    try {
      await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, action: 'reject' }),
      })
      router.push('/admin/prompts')
      router.refresh()
    } catch (err) {
      console.error('Reject error:', err)
      alert(locale === 'fa' ? 'خطا در رد کردن' : 'Reject failed')
    }
  }

  return (
    <div className="mt-8 flex gap-3">
      {status !== 'PUBLISHED' && (
        <button
          onClick={handlePublish}
          className="btn-primary"
        >
          {L(locale, '✅ انتشار', 'Publish')}
        </button>
      )}
      {status === 'PENDING' && (
        <button
          onClick={handleReject}
          className="btn-secondary"
        >
          {L(locale, 'رد کردن', 'Reject')}
        </button>
      )}
    </div>
  )
}
