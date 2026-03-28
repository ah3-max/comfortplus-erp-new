import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// PUT /api/documents/[id] - Update document metadata (category + description)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { documentType, versionNote, documentName } = body

    const existing = await prisma.documentVersion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此文件' }, { status: 404 })

    const doc = await prisma.documentVersion.update({
      where: { id },
      data: {
        ...(documentType !== undefined && { documentType }),
        ...(versionNote !== undefined && { versionNote }),
        ...(documentName !== undefined && { documentName }),
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(doc)
  } catch (error) {
    return handleApiError(error, 'documents.update')
  }
}

// DELETE /api/documents/[id] - Delete document record
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const existing = await prisma.documentVersion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此文件' }, { status: 404 })

    await prisma.documentVersion.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'documents.delete')
  }
}
