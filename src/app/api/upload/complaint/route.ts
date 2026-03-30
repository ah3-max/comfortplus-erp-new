import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { validateUpload, isUploadError } from '@/lib/upload'

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

  const result = await validateUpload(file, ['complaint'])
  if (isUploadError(result)) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'complaints')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, result.safeName), result.buffer)

  return NextResponse.json({
    url:        `/uploads/complaints/${result.safeName}`,
    label:      label || file.name,
    category,
    uploadedAt: new Date().toISOString(),
  }, { status: 201 })
}
