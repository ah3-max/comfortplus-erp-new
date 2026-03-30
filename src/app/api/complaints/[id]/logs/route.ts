import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const logs = await prisma.complaintLog.findMany({
      where: { complaintId: id },
      include: { loggedBy: { select: { id: true, name: true } } },
      orderBy: { logDate: 'desc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    return handleApiError(error, 'complaints.logs.list')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const log = await prisma.complaintLog.create({
      data: {
        complaintId:       id,
        loggedById:        session.user.id,
        logDate:           body.logDate ? new Date(body.logDate) : new Date(),
        action:            body.action,
        description:       body.description,
        nextFollowUpDate:  body.nextFollowUpDate  ? new Date(body.nextFollowUpDate)  : null,
        nextFollowUpMethod: body.nextFollowUpMethod ?? null,
        photoUrls:         Array.isArray(body.photoUrls) ? body.photoUrls : null,
      },
      include: { loggedBy: { select: { id: true, name: true } } },
    })

    // Keep parent complaint in sync
    const updateData: Record<string, unknown> = {}
    if (body.nextFollowUpDate)   updateData.nextFollowUpDate   = new Date(body.nextFollowUpDate)
    if (body.nextFollowUpMethod) updateData.nextFollowUpMethod = body.nextFollowUpMethod
    if (body.action === 'FIRST_RESPONSE') {
      updateData.firstResponseAt     = log.logDate
      updateData.firstResponseMethod = body.nextFollowUpMethod ?? null
      updateData.status              = 'IN_PROGRESS'
    }
    if (body.action === 'RESOLVED') updateData.status = 'RESOLVED'
    if (body.action === 'CLOSED')   { updateData.status = 'CLOSED'; updateData.closedAt = new Date() }

    if (Object.keys(updateData).length) {
      await prisma.complaintRecord.update({ where: { id }, data: updateData })
    }

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'complaints.logs.create')
  }
}
