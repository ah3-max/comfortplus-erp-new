import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

function computePhase(p: { eventStartDate: Date; eventEndDate: Date; prepStartDate: Date; negoStartDate: Date; execStartDate: Date }) {
  const now = new Date()
  if (now >= p.eventEndDate)   return 'REVIEW'
  if (now >= p.eventStartDate) return 'LIVE'
  if (now >= p.execStartDate)  return 'EXECUTION'
  if (now >= p.negoStartDate)  return 'NEGOTIATION'
  return 'PREPARATION'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const promo = await prisma.promoCalendar.findUnique({
    where: { id },
    include: {
      responsibleUser: { select: { id: true, name: true } },
      businessEvents:  { select: { id: true, eventNo: true, title: true, startDate: true, status: true } },
      meetingRecords:  { select: { id: true, meetingNo: true, title: true, meetingDate: true, status: true }, orderBy: { meetingDate: 'desc' } },
    },
  })

  if (!promo) return NextResponse.json({ error: '找不到檔期' }, { status: 404 })
  return NextResponse.json({ ...promo, currentPhase: computePhase(promo) })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const existing = await prisma.promoCalendar.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: '找不到檔期' }, { status: 404 })

  const eventStart = body.eventStartDate ? new Date(body.eventStartDate) : existing.eventStartDate
  const eventEnd   = body.eventEndDate   ? new Date(body.eventEndDate)   : existing.eventEndDate
  const prepStart  = body.prepStartDate  ? new Date(body.prepStartDate)  : existing.prepStartDate
  const negoStart  = body.negoStartDate  ? new Date(body.negoStartDate)  : existing.negoStartDate
  const execStart  = body.execStartDate  ? new Date(body.execStartDate)  : existing.execStartDate

  const promo = await prisma.promoCalendar.update({
    where: { id },
    data: {
      promoName:         body.promoName         ?? undefined,
      promoTier:         body.promoTier         ?? undefined,
      year:              body.year              ? Number(body.year) : undefined,
      eventStartDate:    eventStart,
      eventEndDate:      eventEnd,
      prepStartDate:     prepStart,
      negoStartDate:     negoStart,
      execStartDate:     execStart,
      currentPhase:      computePhase({ eventStartDate: eventStart, eventEndDate: eventEnd, prepStartDate: prepStart, negoStartDate: negoStart, execStartDate: execStart }) as never,
      revenueTarget:     body.revenueTarget     !== undefined ? (body.revenueTarget ? Number(body.revenueTarget) : null) : undefined,
      revenueActual:     body.revenueActual     !== undefined ? (body.revenueActual ? Number(body.revenueActual) : null) : undefined,
      orderTarget:       body.orderTarget       !== undefined ? (body.orderTarget   ? Number(body.orderTarget)   : null) : undefined,
      orderActual:       body.orderActual       !== undefined ? (body.orderActual   ? Number(body.orderActual)   : null) : undefined,
      targetChannels:    body.targetChannels    ?? undefined,
      featuredSkus:      body.featuredSkus      ?? undefined,
      responsibleUserId: body.responsibleUserId !== undefined ? (body.responsibleUserId || null) : undefined,
      reminderSentAt:    body.reminderSentAt    ?? undefined,
      notes:             body.notes             !== undefined ? (body.notes || null) : undefined,
      isActive:          body.isActive          ?? undefined,
    },
  })

  return NextResponse.json(promo)
}
