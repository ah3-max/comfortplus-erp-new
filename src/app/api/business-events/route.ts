import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year       = searchParams.get('year')  ? parseInt(searchParams.get('year')!)  : null
  const month      = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const eventType  = searchParams.get('eventType') ?? ''
  const status     = searchParams.get('status')    ?? ''
  const upcoming   = searchParams.get('upcoming') === 'true'

  const now = new Date()
  const whereDate = upcoming
    ? { startDate: { gte: now } }
    : year && month
      ? {
          startDate: { gte: new Date(year, month - 1, 1) },
          endDate:   { lt:  new Date(year, month, 1) },
        }
      : year
        ? {
            startDate: { gte: new Date(year, 0, 1) },
            endDate:   { lt:  new Date(year + 1, 0, 1) },
          }
        : {}

  const events = await prisma.businessEvent.findMany({
    where: {
      ...whereDate,
      ...(eventType && { eventType: eventType as never }),
      ...(status    && { status:    status    as never }),
    },
    include: {
      owner:         { select: { id: true, name: true } },
      customer:      { select: { id: true, name: true } },
      promoCalendar: { select: { id: true, promoName: true, promoCode: true } },
      _count:        { select: { meetingRecords: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 200,
  })

  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.title || !body.eventType || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: '請填寫標題、類型、開始/結束日期' }, { status: 400 })
  }

  // Generate eventNo
  const today = new Date()
  const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const count = await prisma.businessEvent.count()
  const eventNo = `BE-${d}-${String(count + 1).padStart(4, '0')}`

  const event = await prisma.businessEvent.create({
    data: {
      eventNo,
      title:            body.title,
      eventType:        body.eventType,
      status:           body.status            ?? 'PLANNING',
      startDate:        new Date(body.startDate),
      endDate:          new Date(body.endDate),
      allDay:           body.allDay            ?? true,
      location:         body.location          || null,
      venue:            body.venue             || null,
      channelPlatform:  body.channelPlatform   || null,
      customerId:       body.customerId        || null,
      promoCalendarId:  body.promoCalendarId   || null,
      ownerUserId:      body.ownerUserId       || session.user.id,
      attendeeUserIds:  body.attendeeUserIds   ?? [],
      budget:           body.budget            ? Number(body.budget)     : null,
      actualCost:       body.actualCost        ? Number(body.actualCost) : null,
      prepChecklist:    body.prepChecklist     ?? null,
      tags:             body.tags              ?? [],
      boothSize:        body.boothSize         || null,
      boothNo:          body.boothNo           || null,
      setupDate:        body.setupDate         ? new Date(body.setupDate)    : null,
      teardownDate:     body.teardownDate      ? new Date(body.teardownDate) : null,
      estimatedVisitors: body.estimatedVisitors ? Number(body.estimatedVisitors) : null,
      notes:            body.notes             || null,
      isRecurring:      body.isRecurring       ?? false,
      recurRule:        body.recurRule         || null,
      createdById:      session.user.id,
    },
    include: {
      owner:    { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(event, { status: 201 })
}
