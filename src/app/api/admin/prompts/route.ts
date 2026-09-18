import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const { id, action } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'شناسه پرامپت الزامی است' }, { status: 400 })
    }

    if (action === 'publish') {
      await prisma.prompt.update({
        where: { id },
        data: { status: 'PUBLISHED' },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'reject') {
      await prisma.prompt.update({
        where: { id },
        data: { status: 'REJECTED' },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      await prisma.prompt.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطا در عملیات' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

    await prisma.prompt.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطا در حذف' }, { status: 500 })
  }
}
