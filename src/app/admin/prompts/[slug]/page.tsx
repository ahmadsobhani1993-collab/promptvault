'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function AdminPromptDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [prompt, setPrompt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const slug = params?.slug as string
        if (!slug) {
          setError('شناسه پرامپت یافت نشد')
          setLoading(false)
          return
        }

        const res = await fetch(`/api/admin/prompts/${slug}`)
        if (!res.ok) throw new Error('پرامپت یافت نشد')
        
        const data = await res.json()
        setPrompt(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPrompt()
  }, [params?.slug])

  const handleBack = () => {
    router.push('/admin/prompts')
  }

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>
  if (error) return <div className="p-8 text-center text-red-500">خطا: {error}</div>
  if (!prompt) return <div className="p-8 text-center">پرامپت یافت نشد</div>

  return (
    <div className="container mx-auto p-6">
      <button 
        onClick={handleBack}
        className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
      >
        ← بازگشت
      </button>

      <div className="bg-gray-900 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-yellow-500">{prompt.title}</h1>
        
        {prompt.img && (
          <img src={prompt.img} alt={prompt.title} className="w-full max-w-md rounded" />
        )}
        
        <div>
          <h2 className="font-bold text-gray-300">پرامپت:</h2>
          <pre className="bg-gray-800 p-4 rounded mt-2 text-sm text-gray-300 whitespace-pre-wrap">
            {prompt.prompt}
          </pre>
        </div>

        <div>
          <h2 className="font-bold text-gray-300">اطلاعات:</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li>وضعیت: {prompt.status}</li>
            <li>ایمیل: {prompt.email || 'ثبت نشده'}</li>
            <li>تاریخ: {new Date(prompt.createdAt).toLocaleString('fa-IR')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
