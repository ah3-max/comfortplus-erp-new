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

    const schedule = await prisma.careSchedule.update({
      where: { id },
      data: {
        supervisorId:  body.supervisorId  ?? undefined,
        customerId:    body.customerId    ?? undefined,
        scheduleDate:  body.scheduleDate  ? new Date(body.scheduleDate)  : undefined,
        visitType:     body.visitType     ?? undefined,
        status:        body.status        ?? undefined,
        purpose:       body.purpose       ?? undefined,
        content:       body.content       ?? undefined,
        result:        body.result        ?? undefined,
        nextVisitDate: body.nextVisitDate ? new Date(body.nextVisitDate) : body.nextVisitDate === null ? null : undefined,
        notes:         body.notes         ?? undefined,
        reminderSent:  body.reminderSent  ?? undefined,
      },
      include: {
        supervisor: { select: { id: true, name: true } },
        customer:   { select: { id: true, name: true, code: true } },
        serviceRequests: true,
      },
    })

    return NextResponse.json(schedule)
  } catch (error) {
    return handleApiError(error, 'careSchedules.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await prisma.careSchedule.update({ where: { id }, data: { status: 'CANCELLED' } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'careSchedules.delete')
  }
}
