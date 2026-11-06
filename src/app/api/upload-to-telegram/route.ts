export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { uploadImageToStorage } from '@/lib/arvan-storage'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) {
      return NextResponse.json({ error: 'no file' }, { status: 400 })
    }

    // تبدیل فایل به buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const up = await uploadImageToStorage(buffer, 'promptsfa/articles')

    return NextResponse.json({
      ok: true,
      fileUrl: up.url,
      publicId: up.publicId,
      message: 'عکس با موفقیت در فضای ذخیره‌سازی آروان ذخیره شد.',
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'upload failed' }, { status: 500 })
  }
}
