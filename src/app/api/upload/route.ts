import { NextResponse } from 'next/server'

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'فایلی انتخاب نشده است' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'حجم فایل نباید بیشتر از 3 مگابایت باشد. حجم فعلی: ' + (file.size / 1024 / 1024).toFixed(2) + ' MB'
        }, 
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'فایل انتخابی باید تصویر باشد' }, { status: 400 })
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'فایل معتبر است و آماده آپلود می‌باشد' 
    })
    
  } catch (error) {
    console.error('Upload validation error:', error)
    return NextResponse.json({ error: 'خطا در پردازش فایل' }, { status: 500 })
  }
}