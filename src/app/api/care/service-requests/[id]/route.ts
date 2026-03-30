import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const resolvedAt = body.status === 'RESOLVED' || body.status === 'CLOSED' ? new Date() : undefined

    const request = await prisma.serviceRequest.update({
      where: { id },
      data: {
        requestType:    body.requestType    ?? undefined,
        urgency:        body.urgency        ?? undefined,
        status:         body.status         ?? undefined,
        description:    body.description    ?? undefined,
        resolution:     body.resolution     ?? undefined,
        assignedToId:   body.assignedToId   !== undefined ? (body.assignedToId || null) : undefined,
        careScheduleId: body.careScheduleId !== undefined ? (body.careScheduleId || null) : undefined,
        ...(resolvedAt && { resolvedAt }),
      },
      include: {
        customer:   { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(request)
  } catch (error) {
    return handleApiError(error, 'serviceRequests.update')
  }
}
