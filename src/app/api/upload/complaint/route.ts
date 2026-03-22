import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST /api/upload/complaint — upload a photo for a complaint record or log
// FormData: file (required), label?, category?
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const label    = (formData.get('label') as string) ?? ''
  const category = (formData.get('category') as string) ?? 'complaint'

  if (!file) return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })

  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'pdf']
  const ext = (path.extname(file.name).replace('.', '') || 'jpg').toLowerCase()
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: '不支援的檔案類型' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'complaints')
  await mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = path.join(uploadDir, safeName)

  await writeFile(filePath, Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    url:        `/uploads/complaints/${safeName}`,
    label:      label || file.name,
    category,
    uploadedAt: new Date().toISOString(),
  }, { status: 201 })
}
