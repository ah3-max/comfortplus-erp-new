import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

interface PhotoEntry {
  url: string
  label: string
  uploadedAt: string
}

/**
 * POST /api/sales-returns/[id]/photos
 * S-16: Upload damage photos for return orders
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const record = await prisma.returnOrder.findUnique({
      where: { id },
      select: { id: true, photoUrls: true },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const label = (formData.get('label') as string) || '退貨照片'

    if (!file) return NextResponse.json({ error: '請上傳照片' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic)$/i)) {
      return NextResponse.json({ error: '僅接受 JPEG/PNG/WebP/HEIC 格式' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '照片不可超過 10MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeName = `return-${id}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images')
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, safeName), buffer)

    const photoUrl = `/uploads/images/${safeName}`

    const existing = (record.photoUrls as unknown as PhotoEntry[]) ?? []
    const updated = await prisma.returnOrder.update({
      where: { id },
      data: {
        photoUrls: [
          ...existing,
          { url: photoUrl, label, uploadedAt: new Date().toISOString() },
        ] as unknown as never,
      },
      select: { id: true, photoUrls: true },
    })

    return NextResponse.json({ url: photoUrl, photoUrls: updated.photoUrls }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'salesReturns.photos.upload')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const { url } = await req.json()

    const record = await prisma.returnOrder.findUnique({
      where: { id },
      select: { photoUrls: true },
    })
    if (!record) return NextResponse.json({ error: '找不到退貨單' }, { status: 404 })

    const existing = (record.photoUrls as unknown as PhotoEntry[]) ?? []
    const updated = await prisma.returnOrder.update({
      where: { id },
      data: { photoUrls: existing.filter(p => p.url !== url) as unknown as never },
      select: { id: true, photoUrls: true },
    })

    return NextResponse.json({ photoUrls: updated.photoUrls })
  } catch (error) {
    return handleApiError(error, 'salesReturns.photos.delete')
  }
}
