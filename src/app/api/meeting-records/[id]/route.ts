import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const record = await prisma.meetingRecord.findUnique({
    where: { id },
    include: {
      facilitator:   { select: { id: true, name: true, role: true } },
      customer:      { select: { id: true, name: true, code: true } },
      businessEvent: { select: { id: true, eventNo: true, title: true, eventType: true, startDate: true } },
      promoCalendar: { select: { id: true, promoCode: true, promoName: true } },
      actionItems: {
        include: { owner: { select: { id: true, name: true } } },
        orderBy:  [{ status: 'asc' }, { dueDate: 'asc' }],
      },
    },
  })

  if (!record) return NextResponse.json({ error: '找不到會議記錄' }, { status: 404 })

  // For channel negotiation: fetch history
  let negotiationHistory: unknown[] = []
  if (record.meetingType === 'CHANNEL_NEGOTIATION' && record.customerId) {
    negotiationHistory = await prisma.meetingRecord.findMany({
      where: {
        customerId:  record.customerId,
        meetingType: 'CHANNEL_NEGOTIATION',
        id:          { not: id },
      },
      select: {
        id: true, meetingNo: true, title: true, meetingDate: true,
        negotiationOutcome: true, decisions: true,
        nextNegotiationDate: true,
      },
      orderBy: { meetingDate: 'desc' },
      take: 10,
    })
  }

  return NextResponse.json({ ...record, negotiationHistory })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const record = await prisma.meetingRecord.update({
    where: { id },
    data: {
      title:              body.title              ?? undefined,
      meetingType:        body.meetingType        ?? undefined,
      status:             body.status             ?? undefined,
      meetingDate:        body.meetingDate        ? new Date(body.meetingDate) : undefined,
      startTime:          body.startTime          !== undefined ? (body.startTime ? new Date(body.startTime) : null) : undefined,
      endTime:            body.endTime            !== undefined ? (body.endTime   ? new Date(body.endTime)   : null) : undefined,
      location:           body.location           !== undefined ? (body.location || null) : undefined,
      isOnline:           body.isOnline           ?? undefined,
      meetingUrl:         body.meetingUrl         !== undefined ? (body.meetingUrl || null) : undefined,
      businessEventId:    body.businessEventId    !== undefined ? (body.businessEventId || null)  : undefined,
      promoCalendarId:    body.promoCalendarId    !== undefined ? (body.promoCalendarId || null)   : undefined,
      customerId:         body.customerId         !== undefined ? (body.customerId || null)         : undefined,
      channelName:        body.channelName        !== undefined ? (body.channelName || null)        : undefined,
      facilitatorId:      body.facilitatorId      ?? undefined,
      attendeesJson:      body.attendeesJson      !== undefined ? body.attendeesJson : undefined,
      externalAttendees:  body.externalAttendees  !== undefined ? (body.externalAttendees || null) : undefined,
      agenda:             body.agenda             !== undefined ? (body.agenda || null)             : undefined,
      summary:            body.summary            !== undefined ? (body.summary || null)            : undefined,
      minutesText:        body.minutesText        !== undefined ? (body.minutesText || null)        : undefined,
      decisions:          body.decisions          !== undefined ? (body.decisions || null)          : undefined,
      negotiationContext: body.negotiationContext !== undefined ? (body.negotiationContext || null) : undefined,
      negotiationOutcome: body.negotiationOutcome !== undefined ? (body.negotiationOutcome || null) : undefined,
      nextNegotiationDate: body.nextNegotiationDate !== undefined ? (body.nextNegotiationDate ? new Date(body.nextNegotiationDate) : null) : undefined,
      photoUrls:          body.photoUrls          !== undefined ? body.photoUrls : undefined,
      audioFileUrl:       body.audioFileUrl       !== undefined ? (body.audioFileUrl || null)      : undefined,
      audioDurationSec:   body.audioDurationSec   !== undefined ? (body.audioDurationSec ? Number(body.audioDurationSec) : null) : undefined,
      transcriptText:     body.transcriptText     !== undefined ? (body.transcriptText || null)    : undefined,
      transcriptStatus:   body.transcriptStatus   ?? undefined,
      aiSummary:          body.aiSummary          !== undefined ? (body.aiSummary || null)         : undefined,
      aiActionItems:      body.aiActionItems      !== undefined ? body.aiActionItems               : undefined,
      aiProcessedAt:      body.aiProcessedAt      !== undefined ? (body.aiProcessedAt ? new Date(body.aiProcessedAt) : null) : undefined,
    },
  })

  return NextResponse.json(record)
}
