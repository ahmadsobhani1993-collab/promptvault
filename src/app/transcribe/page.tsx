import dynamic from 'next/dynamic'

const TranscribeClient = dynamic(() => import('@/components/transcribe/TranscribeClient'), {
  ssr: false,
})

export const metadata = {
  title: 'ترنسکریپت صدا و ویدیو | PromptsFA',
  description: 'تبدیل گفتار به متن و زیرنویس با هوش مصنوعی Gemini',
}

export default function TranscribePage() {
  return <TranscribeClient />
}
