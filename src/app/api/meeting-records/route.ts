import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const meetingType     = searchParams.get('meetingType')     ?? ''
    const status          = searchParams.get('status')          ?? ''
    const customerId      = searchParams.get('customerId')      ?? ''
    const businessEventId = searchParams.get('businessEventId') ?? ''
    const search          = searchParams.get('search')          ?? ''
    const from            = searchParams.get('from')
    const to              = searchParams.get('to')

    const records = await prisma.meetingRecord.findMany({
      where: {
        ...(meetingType     && { meetingType:     meetingType     as never }),
        ...(status          && { status:          status          as never }),
        ...(customerId      && { customerId }),
        ...(businessEventId && { businessEventId }),
        ...(from || to) && {
          meetingDate: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to)   }),
          },
        },
        ...(search && {
          OR: [
            { title:       { contains: search, mode: 'insensitive' } },
            { channelName: { contains: search, mode: 'insensitive' } },
            { summary:     { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        facilitator:   { select: { id: true, name: true } },
        customer:      { select: { id: true, name: true } },
        businessEvent: { select: { id: true, title: true, eventType: true } },
        _count:        { select: { actionItems: true } },
      },
      orderBy: { meetingDate: 'desc' },
      take: 100,
    })

    return NextResponse.json(records)
  } catch (error) {
    return handleApiError(error, 'meetingRecords.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.title || !body.meetingType || !body.meetingDate) {
      return NextResponse.json({ error: '請填寫標題、類型、會議日期' }, { status: 400 })
    }

    const today = new Date()
    const d = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
    const count = await prisma.meetingRecord.count()
    const meetingNo = `MR-${d}-${String(count + 1).padStart(4, '0')}`

    const record = await prisma.meetingRecord.create({
      data: {
        meetingNo,
        title:              body.title,
        meetingType:        body.meetingType,
        status:             body.status           ?? 'SCHEDULED',
        meetingDate:        new Date(body.meetingDate),
        startTime:          body.startTime        ? new Date(body.startTime) : null,
        endTime:            body.endTime          ? new Date(body.endTime)   : null,
        location:           body.location         || null,
        isOnline:           body.isOnline         ?? false,
        meetingUrl:         body.meetingUrl        || null,
        businessEventId:    body.businessEventId   || null,
        promoCalendarId:    body.promoCalendarId   || null,
        customerId:         body.customerId        || null,
        channelName:        body.channelName       || null,
        facilitatorId:      body.facilitatorId     || session.user.id,
        attendeesJson:      body.attendeesJson     ?? null,
        externalAttendees:  body.externalAttendees || null,
        agenda:             body.agenda            || null,
        summary:            body.summary           || null,
        minutesText:        body.minutesText       || null,
        decisions:          body.decisions         || null,
        negotiationContext: body.negotiationContext || null,
        negotiationOutcome: body.negotiationOutcome || null,
        nextNegotiationDate: body.nextNegotiationDate ? new Date(body.nextNegotiationDate) : null,
        audioFileUrl:       body.audioFileUrl      || null,
        createdById:        session.user.id,
      },
      include: {
        facilitator: { select: { id: true, name: true } },
        customer:    { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'meetingRecords.create')
  }
}
