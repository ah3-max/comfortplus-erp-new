import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { validateUpload, isUploadError } from '@/lib/upload'

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10MB

// GET — list attachments for an incident (filters out sensitive if not manager+)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const canSeeSensitive = ['MANAGER', 'SALES_MANAGER', 'GM', 'SUPER_ADMIN'].includes(session.user.role ?? '')

  const attachments = await prisma.incidentAttachment.findMany({
    where: {
      incidentId: id,
      ...(!canSeeSensitive && { isSensitive: false }),
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { uploadedAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

// POST — upload + record an attachment (multipart)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData      = await req.formData()
  const file          = formData.get('file') as File | null
  const attachmentType = (formData.get('attachmentType') as string) ?? 'OTHER'
  const description   = formData.get('description')   as string | null
  const capturedAt    = formData.get('capturedAt')    as string | null
  const isSensitive   = formData.get('isSensitive') === 'true'
  const relatedStage  = formData.get('relatedStage')  as string | null
  const visitLogId    = formData.get('visitLogId')    as string | null
  const trainingLogId = formData.get('trainingLogId') as string | null

  // Skin photos are always sensitive
  const sensitive = isSensitive || attachmentType === 'SKIN_PHOTO'

  if (!file) return NextResponse.json({ error: '請提供檔案' }, { status: 400 })

  // Validate: allow images and documents; audio not accepted as incident attachments
  const result = await validateUpload(file, ['image', 'document', 'complaint'], MAX_ATTACHMENT_SIZE)
  if (isUploadError(result)) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  const subDir    = sensitive ? 'incidents/sensitive' : 'incidents'
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir)
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, result.safeName), result.buffer)

  const attachment = await prisma.incidentAttachment.create({
    data: {
      incidentId:      id,
      visitLogId:      visitLogId     || null,
      trainingLogId:   trainingLogId  || null,
      attachmentType:  attachmentType as never,
      fileUrl:         `/uploads/${subDir}/${result.safeName}`,
      fileName:        file.name,
      fileSizeBytes:   file.size,
      mimeType:        file.type || null,
      description:     description  || null,
      capturedAt:      capturedAt   ? new Date(capturedAt) : null,
      isSensitive:     sensitive,
      relatedStage:    relatedStage || null,
      uploadedById:    session.user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(attachment, { status: 201 })
}

// DELETE /api/incidents/[id]/attachments?attachmentId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const { searchParams } = new URL(req.url)
  const attachmentId = searchParams.get('attachmentId')
  if (!attachmentId) return NextResponse.json({ error: 'attachmentId required' }, { status: 400 })

  await prisma.incidentAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ success: true })
}
