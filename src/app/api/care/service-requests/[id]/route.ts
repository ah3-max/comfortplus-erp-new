import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
}
