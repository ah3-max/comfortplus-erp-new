import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/documents - List documents with search + category filter, paginated
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const category = searchParams.get('category') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where: Record<string, unknown> = {}
    if (category && category !== 'ALL') where.documentType = category
    if (search) {
      where.OR = [
        { documentName: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
        { versionNote: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [documents, total] = await Promise.all([
      prisma.documentVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      prisma.documentVersion.count({ where }),
    ])

    return NextResponse.json({
      data: documents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    return handleApiError(error, 'documents.list')
  }
}

// POST /api/documents - Create new document record
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { documentName, documentType, fileUrl, fileName, fileSizeBytes, mimeType, versionNote } =
      body

    if (!documentName || !documentType || !fileUrl || !fileName) {
      return NextResponse.json(
        { error: '缺少必填欄位：文件名稱、類別、檔案名稱、檔案路徑' },
        { status: 400 },
      )
    }

    const doc = await prisma.documentVersion.create({
      data: {
        documentType,
        documentName,
        version: 1,
        versionNote: versionNote ?? null,
        fileUrl,
        fileName,
        fileSizeBytes: fileSizeBytes ? Number(fileSizeBytes) : null,
        mimeType: mimeType ?? null,
        status: 'ACTIVE',
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'documents.create')
  }
}
