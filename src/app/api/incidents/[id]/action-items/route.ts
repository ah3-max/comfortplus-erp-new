import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const items = await prisma.incidentActionItem.findMany({
      where:   { incidentId: id },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    })
    return NextResponse.json(items)
  } catch (error) {
    return handleApiError(error, 'incidents.actionItems.list')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const item = await prisma.incidentActionItem.create({
      data: {
        incidentId:        id,
        actionTitle:       body.actionTitle,
        actionDescription: body.actionDescription || null,
        ownerUserId:       body.ownerUserId       || null,
        dueDate:           body.dueDate ? new Date(body.dueDate) : null,
        status:            'OPEN' as never,
      },
      include: { owner: { select: { id: true, name: true } } },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'incidents.actionItems.create')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await params
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('itemId')
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.status)            data.status            = body.status
    if (body.completionNote)    data.completionNote    = body.completionNote
    if (body.actionDescription) data.actionDescription = body.actionDescription
    if (body.dueDate)           data.dueDate           = new Date(body.dueDate)
    if (body.ownerUserId)       data.ownerUserId       = body.ownerUserId
    if (body.status === 'DONE') data.completedAt = new Date()

    const item = await prisma.incidentActionItem.update({
      where:   { id: itemId },
      data,
      include: { owner: { select: { id: true, name: true } } },
    })
    return NextResponse.json(item)
  } catch (error) {
    return handleApiError(error, 'incidents.actionItems.update')
  }
}
