import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { validateUpload, isUploadError, type UploadCategory } from '@/lib/upload'

const ALLOWED_TYPES = ['image', 'audio', 'document'] as const
type UploadType = (typeof ALLOWED_TYPES)[number]

const TYPE_TO_CATEGORY: Record<UploadType, UploadCategory[]> = {
  image:    ['image'],
  audio:    ['audio'],
  document: ['document'],
}

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

  const categories = TYPE_TO_CATEGORY[type as UploadType]
  const result = await validateUpload(file, categories)
  if (isUploadError(result)) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  const subDir = getSubDir(type as UploadType)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir)
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, result.safeName), result.buffer)

  const { randomUUID } = await import('crypto')
  return NextResponse.json(
    {
      id: randomUUID(),
      url: `/uploads/${subDir}/${result.safeName}`,
      fileName: result.safeName,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    },
    { status: 201 }
  )
}
