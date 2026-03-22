import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_TYPES = ['image', 'audio', 'document'] as const
type UploadType = (typeof ALLOWED_TYPES)[number]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp3', '.m4a', '.wav', '.pdf', '.doc', '.docx', '.xls', '.xlsx']

function getSubDir(type: UploadType): string {
  return type === 'audio' ? 'audio' : `${type}s`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!type || !ALLOWED_TYPES.includes(type as UploadType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  // File size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `檔案過大，上限 ${MAX_FILE_SIZE / 1024 / 1024}MB（目前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` },
      { status: 400 }
    )
  }

  // Image MIME type check
  if (type === 'image' && file.type && !ALLOWED_IMAGE_MIMES.includes(file.type)) {
    return NextResponse.json(
      { error: `不支援的圖片格式（${file.type}）。支援：JPEG、PNG、WebP、HEIC` },
      { status: 400 }
    )
  }

  // Extension check
  const ext = path.extname(file.name).toLowerCase() || '.bin'
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json(
      { error: `不支援的檔案類型（${ext}）` },
      { status: 400 }
    )
  }

  const subDir = getSubDir(type as UploadType)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir)
  await mkdir(uploadDir, { recursive: true })

  const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`
  const filePath = path.join(uploadDir, uniqueName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const url = `/uploads/${subDir}/${uniqueName}`

  return NextResponse.json(
    {
      id: crypto.randomUUID(),
      url,
      fileName: uniqueName,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    },
    { status: 201 }
  )
}
