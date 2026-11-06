export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { uploadImageToStorage, uploadVideoToStorage } from '@/lib/arvan-storage'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // افزایش تا ۱۰ مگابایت با خیال راحت
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])

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

    const isVideo = VIDEO_TYPES.has(file.type)
    if (!file.type.startsWith('image/') && !isVideo) {
      return NextResponse.json({ error: 'فایل باید تصویر یا ویدیو باشد' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let thumbnail: Buffer | undefined

    if (isVideo) {
      const thumbnailFile = formData.get('thumbnail')
      if (thumbnailFile instanceof File) {
        if (thumbnailFile.type !== 'image/jpeg' || thumbnailFile.size > 2 * 1024 * 1024) {
          return NextResponse.json({ error: 'Invalid video thumbnail' }, { status: 400 })
        }
        thumbnail = Buffer.from(await thumbnailFile.arrayBuffer())
      }
    }

    const result = isVideo
      ? await uploadVideoToStorage(buffer, file.type, 'user-uploads', thumbnail)
      : { ...await uploadImageToStorage(buffer, 'user-uploads'), posterUrl: undefined }

    return NextResponse.json({
      url: result.url,
      public_id: result.publicId,
      secure_url: result.url,
      posterUrl: result.posterUrl,
      mediaType: isVideo ? 'VIDEO' : 'IMAGE',
    })
    
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error?.message || 'خطا در آپلود' }, { status: 500 })
  }
}
