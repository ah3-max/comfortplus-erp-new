import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/documents - List documents with version history
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const documentType = searchParams.get('type')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)

  const where: any = {}
  if (documentType) where.documentType = documentType
  if (status) where.status = status

  const docs = await prisma.documentVersion.findMany({
    where,
    orderBy: [{ documentType: 'asc' }, { documentName: 'asc' }, { version: 'desc' }],
    take: limit,
    include: { createdBy: { select: { id: true, name: true } } },
  })

  const stats = await prisma.documentVersion.groupBy({
    by: ['documentType'],
    _count: { id: true },
    where: { status: 'ACTIVE' },
  })

  return NextResponse.json({ documents: docs, stats })
}

// POST /api/documents - Create new document version
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // If uploading a new version, supersede the old one
  if (body.previousVersionId) {
    await prisma.documentVersion.update({
      where: { id: body.previousVersionId },
      data: { status: 'SUPERSEDED' },
    })
  }

  const doc = await prisma.documentVersion.create({
    data: {
      documentType: body.documentType,
      relatedType: body.relatedType,
      relatedId: body.relatedId,
      documentName: body.documentName,
      version: body.version ?? 1,
      versionNote: body.versionNote,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSizeBytes: body.fileSizeBytes,
      mimeType: body.mimeType,
      status: body.status ?? 'DRAFT',
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
      previousVersionId: body.previousVersionId,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { name: true } } },
  })
  return NextResponse.json(doc, { status: 201 })
}
