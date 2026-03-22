import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const event = await prisma.businessEvent.findUnique({
    where: { id },
    include: {
      owner:         { select: { id: true, name: true } },
      customer:      { select: { id: true, name: true, code: true } },
      promoCalendar: true,
      meetingRecords: {
        select: { id: true, meetingNo: true, title: true, meetingDate: true, status: true, meetingType: true },
        orderBy: { meetingDate: 'desc' },
      },
    },
  })

  if (!event) return NextResponse.json({ error: '找不到活動' }, { status: 404 })
  return NextResponse.json(event)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const event = await prisma.businessEvent.update({
    where: { id },
    data: {
      title:             body.title             ?? undefined,
      eventType:         body.eventType         ?? undefined,
      status:            body.status            ?? undefined,
      startDate:         body.startDate         ? new Date(body.startDate) : undefined,
      endDate:           body.endDate           ? new Date(body.endDate)   : undefined,
      allDay:            body.allDay            ?? undefined,
      location:          body.location          !== undefined ? (body.location || null)         : undefined,
      venue:             body.venue             !== undefined ? (body.venue || null)             : undefined,
      channelPlatform:   body.channelPlatform   !== undefined ? (body.channelPlatform || null)  : undefined,
      customerId:        body.customerId        !== undefined ? (body.customerId || null)        : undefined,
      promoCalendarId:   body.promoCalendarId   !== undefined ? (body.promoCalendarId || null)  : undefined,
      ownerUserId:       body.ownerUserId       ?? undefined,
      attendeeUserIds:   body.attendeeUserIds   ?? undefined,
      budget:            body.budget            !== undefined ? (body.budget ? Number(body.budget) : null) : undefined,
      actualCost:        body.actualCost        !== undefined ? (body.actualCost ? Number(body.actualCost) : null) : undefined,
      prepChecklist:     body.prepChecklist     !== undefined ? body.prepChecklist : undefined,
      tags:              body.tags              ?? undefined,
      boothSize:         body.boothSize         !== undefined ? (body.boothSize || null) : undefined,
      boothNo:           body.boothNo           !== undefined ? (body.boothNo || null)   : undefined,
      setupDate:         body.setupDate         !== undefined ? (body.setupDate ? new Date(body.setupDate) : null) : undefined,
      teardownDate:      body.teardownDate      !== undefined ? (body.teardownDate ? new Date(body.teardownDate) : null) : undefined,
      estimatedVisitors: body.estimatedVisitors !== undefined ? (body.estimatedVisitors ? Number(body.estimatedVisitors) : null) : undefined,
      actualVisitors:    body.actualVisitors    !== undefined ? (body.actualVisitors ? Number(body.actualVisitors) : null)    : undefined,
      leadsCollected:    body.leadsCollected    !== undefined ? (body.leadsCollected ? Number(body.leadsCollected) : null)    : undefined,
      ordersTaken:       body.ordersTaken       !== undefined ? (body.ordersTaken ? Number(body.ordersTaken) : null)          : undefined,
      notes:             body.notes             !== undefined ? (body.notes || null) : undefined,
    },
  })

  return NextResponse.json(event)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const event = await prisma.businessEvent.findUnique({ where: { id }, select: { status: true } })
  if (!event) return NextResponse.json({ error: '找不到活動' }, { status: 404 })
  if (event.status !== 'PLANNING') return NextResponse.json({ error: '只有規劃中的活動可以刪除' }, { status: 400 })

  await prisma.businessEvent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
