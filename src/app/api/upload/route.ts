export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { uploadToCloudinary } from '@/lib/cloudinary'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // افزایش تا ۱۰ مگابایت با خیال راحت

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'فایلی انتخاب نشده است' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'حجم فایل نباید بیشتر از 10 مگابایت باشد' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'فایل باید تصویر باشد' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // آپلود روی ابر آروان با فرمت سبک WebP
    const result = await uploadToCloudinary(buffer, 'user-uploads')

    return NextResponse.json({
      url: result.url,
      public_id: result.publicId,
      secure_url: result.url
    })
    
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error?.message || 'خطا در آپلود' }, { status: 500 })
  }
}
