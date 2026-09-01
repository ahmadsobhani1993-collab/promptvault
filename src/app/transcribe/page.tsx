import TranscribeClient from '@/components/transcribe/TranscribeClient'

export const metadata = {
  title: 'استخراج متن صدا و ویدیو | PromptsFA',
  description: 'تبدیل صوت و فیلم به متن',
}

export default function TranscribePage() {
  return <TranscribeClient />
}
