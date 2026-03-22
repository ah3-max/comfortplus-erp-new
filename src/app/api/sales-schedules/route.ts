import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId  = searchParams.get('customerId')
  const salesRepId  = searchParams.get('salesRepId')
  const from        = searchParams.get('from')
  const to          = searchParams.get('to')
  const isCompleted = searchParams.get('isCompleted')

  const schedules = await prisma.salesSchedule.findMany({
    where: {
      ...(customerId  ? { customerId }  : {}),
      ...(salesRepId  ? { salesRepId }  : {}),
      ...(isCompleted !== null ? { isCompleted: isCompleted === 'true' } : {}),
      ...(from || to ? {
        scheduleDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    },
    include: {
      customer:  { select: { id: true, name: true, code: true } },
      salesRep:  { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { scheduleDate: 'asc' },
  })

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    customerId, salesRepId, scheduleDate, startTime, endTime,
    location, scheduleType, preReminder, notes,
  } = body

  if (!customerId || !salesRepId || !scheduleDate) {
    return NextResponse.json({ error: '客戶、業務、行程日期為必填' }, { status: 400 })
  }

  const schedule = await prisma.salesSchedule.create({
    data: {
      customerId,
      salesRepId,
      scheduleDate: new Date(scheduleDate),
      startTime:    startTime ? new Date(startTime) : null,
      endTime:      endTime   ? new Date(endTime)   : null,
      location:     location  ?? null,
      scheduleType: scheduleType ?? 'OTHER',
      preReminder:  preReminder  ?? null,
      notes:        notes        ?? null,
      createdById:  session.user.id,
    },
    include: {
      customer: { select: { id: true, name: true } },
      salesRep: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(schedule, { status: 201 })
}
