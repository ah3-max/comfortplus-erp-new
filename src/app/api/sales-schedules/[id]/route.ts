import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const schedule = await prisma.salesSchedule.findUnique({
    where: { id },
    include: {
      customer:  { select: { id: true, name: true, code: true } },
      salesRep:  { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(schedule)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const {
    scheduleDate, startTime, endTime, location,
    scheduleType, preReminder, postResult, isCompleted, notes,
  } = body

  const updated = await prisma.salesSchedule.update({
    where: { id },
    data: {
      ...(scheduleDate !== undefined ? { scheduleDate: new Date(scheduleDate) } : {}),
      ...(startTime    !== undefined ? { startTime: startTime ? new Date(startTime) : null } : {}),
      ...(endTime      !== undefined ? { endTime:   endTime   ? new Date(endTime)   : null } : {}),
      ...(location     !== undefined ? { location }     : {}),
      ...(scheduleType !== undefined ? { scheduleType } : {}),
      ...(preReminder  !== undefined ? { preReminder }  : {}),
      ...(postResult   !== undefined ? { postResult }   : {}),
      ...(isCompleted  !== undefined ? { isCompleted }  : {}),
      ...(notes        !== undefined ? { notes }        : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.salesSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
