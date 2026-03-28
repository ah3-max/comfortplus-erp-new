import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/knowledge/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const entry = await prisma.knowledgeBaseEntry.findUnique({
      where: { id },
      include: {
        incident: { select: { id: true, incidentNo: true, severity: true, status: true } },
      },
    })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (error) {
    return handleApiError(error, 'knowledge.get')
  }
}

// PUT /api/knowledge/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const entry = await prisma.knowledgeBaseEntry.update({
      where: { id },
      data: {
        ...(body.entryType !== undefined && { entryType: body.entryType }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.summary !== undefined && { summary: body.summary }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.relatedSkus !== undefined && { relatedSkus: body.relatedSkus }),
        ...(body.relatedBatchNos !== undefined && { relatedBatchNos: body.relatedBatchNos }),
        ...(body.customerTypes !== undefined && { customerTypes: body.customerTypes }),
        ...(body.symptomCodes !== undefined && { symptomCodes: body.symptomCodes }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
    })
    return NextResponse.json(entry)
  } catch (error) {
    return handleApiError(error, 'knowledge.update')
  }
}

// DELETE /api/knowledge/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.knowledgeBaseEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'knowledge.delete')
  }
}
