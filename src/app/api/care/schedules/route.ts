import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const supervisorId = searchParams.get('supervisorId') ?? ''
    const customerId   = searchParams.get('customerId')   ?? ''
    const status       = searchParams.get('status')       ?? ''
    const dateFrom     = searchParams.get('dateFrom')     ?? ''
    const dateTo       = searchParams.get('dateTo')       ?? ''
    const upcoming     = searchParams.get('upcoming') === 'true'

    const now = new Date()

    const schedules = await prisma.careSchedule.findMany({
      where: {
        ...(supervisorId && { supervisorId }),
        ...(customerId   && { customerId }),
        ...(status       && { status: status as never }),
        ...(upcoming     && { scheduleDate: { gte: now }, status: 'SCHEDULED' }),
        ...(dateFrom     && !upcoming && { scheduleDate: { gte: new Date(dateFrom) } }),
        ...(dateTo       && !upcoming && { scheduleDate: { lte: new Date(dateTo + 'T23:59:59') } }),
      },
      include: {
        supervisor:      { select: { id: true, name: true } },
        customer:        { select: { id: true, name: true, code: true, address: true, phone: true, contactPerson: true } },
        serviceRequests: { select: { id: true, requestType: true, urgency: true, status: true } },
      },
      orderBy: { scheduleDate: 'asc' },
    })

    return NextResponse.json(schedules)
  } catch (error) {
    return handleApiError(error, 'careSchedules.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.customerId || !body.scheduleDate) {
      return NextResponse.json({ error: '請選擇客戶與排程日期' }, { status: 400 })
    }

    const scheduleNo = await generateSequenceNo('CARE')

    const schedule = await prisma.careSchedule.create({
      data: {
        scheduleNo,
        supervisorId:  body.supervisorId ?? session.user.id,
        customerId:    body.customerId,
        scheduleDate:  new Date(body.scheduleDate),
        visitType:     body.visitType ?? 'ROUTINE_VISIT',
        purpose:       body.purpose   || null,
        notes:         body.notes     || null,
      },
      include: {
        supervisor: { select: { id: true, name: true } },
        customer:   { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'careSchedules.create')
  }
}
