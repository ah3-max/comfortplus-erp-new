import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const INCLUDE = {
  reportedBy:         { select: { id: true, name: true } },
  assignedSupervisor: { select: { id: true, name: true } },
  _count:             { select: { logs: true } },
  logs: {
    orderBy: { logDate: 'desc' as const },
    take: 5,
    include: { loggedBy: { select: { id: true, name: true } } },
  },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const records = await prisma.complaintRecord.findMany({
    where:   { customerId: id },
    include: INCLUDE,
    orderBy: { complaintDate: 'desc' },
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const record = await prisma.complaintRecord.create({
    data: {
      customerId:           id,
      reportedById:         session.user.id,
      complaintDate:        new Date(body.complaintDate),
      type:                 body.type     || 'COMPLAINT',
      content:              body.content,
      status:               'OPEN',
      severity:             body.severity || 'MEDIUM',
      assignedSupervisorId: body.assignedSupervisorId || null,
      supervisorAppointDate: body.supervisorAppointDate ? new Date(body.supervisorAppointDate) : null,
      handler:              body.handler  || null,
      photoUrls:            Array.isArray(body.photoUrls) ? body.photoUrls : null,
    },
    include: INCLUDE,
  })

  // If severity is HIGH or CRITICAL, auto-set nextFollowUpDate to tomorrow
  if (['HIGH', 'CRITICAL'].includes(body.severity)) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await prisma.complaintRecord.update({
      where: { id: record.id },
      data:  { nextFollowUpDate: tomorrow, nextFollowUpMethod: 'PHONE_CALL' },
    })
  }

  return NextResponse.json(record, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })
  await params

  const body = await req.json()
  const now = new Date()

  const data: Record<string, unknown> = {
    status:               body.status     || undefined,
    severity:             body.severity   || undefined,
    handler:              body.handler    ?? undefined,
    resolution:           body.resolution ?? undefined,
    assignedSupervisorId: body.assignedSupervisorId ?? undefined,
    supervisorAppointDate: body.supervisorAppointDate ? new Date(body.supervisorAppointDate) : undefined,
    firstResponseAt:      body.firstResponseAt ? new Date(body.firstResponseAt) : undefined,
    firstResponseMethod:  body.firstResponseMethod ?? undefined,
    nextFollowUpDate:     body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : undefined,
    nextFollowUpMethod:   body.nextFollowUpMethod ?? undefined,
    photoUrls:            Array.isArray(body.photoUrls) ? body.photoUrls : undefined,
  }

  if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
    data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : now
  }
  if (body.status === 'CLOSED') {
    data.closedAt = body.closedAt ? new Date(body.closedAt) : now
  }
  // Record first response if not yet set
  if (body.firstResponseMethod && !body.firstResponseAt) {
    data.firstResponseAt = now
    data.status = data.status || 'IN_PROGRESS'
  }

  const record = await prisma.complaintRecord.update({
    where:  { id: recordId },
    data,
    include: INCLUDE,
  })

  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  await params
  await prisma.complaintRecord.delete({ where: { id: recordId } })
  return NextResponse.json({ success: true })
}
