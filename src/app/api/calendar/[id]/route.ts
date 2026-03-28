import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// Map simplified UI event types to BusinessEventType DB enum
const EVENT_TYPE_MAP: Record<string, string> = {
  MEETING:    'WEEKLY_ADMIN',
  VISIT:      'OTHER',
  DELIVERY:   'CHANNEL_PROMO',
  PRODUCTION: 'MAJOR_PROMO',
  HOLIDAY:    'OTHER',
  OTHER:      'OTHER',
}

// Reverse map: DB type + tag → display type
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const event = await prisma.businessEvent.findUnique({
      where: { id },
      include: { owner: { select: { name: true } } },
    })
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(event)
  } catch (error) {
    return handleApiError(error, 'calendar.get')
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { title, eventType, startDate, startTime, endDate, endTime, description, isAllDay } = body

    if (!title) return NextResponse.json({ error: '標題為必填' }, { status: 400 })
    if (!startDate) return NextResponse.json({ error: '開始日期為必填' }, { status: 400 })

    // Build datetime values
    const startDatetime = isAllDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime || '00:00'}:00`)

    const endDatetime = endDate
      ? (isAllDay
          ? new Date(`${endDate}T23:59:59`)
          : new Date(`${endDate}T${endTime || '23:59'}:00`))
      : startDatetime

    const dbEventType = EVENT_TYPE_MAP[eventType] ?? 'OTHER'

    const event = await prisma.businessEvent.update({
      where: { id },
      data: {
        title,
        eventType: dbEventType as never,
        startDate: startDatetime,
        endDate: endDatetime,
        allDay: Boolean(isAllDay),
        notes: description ?? null,
        tags: [eventType],  // store original UI type as tag for display
      },
    })

    return NextResponse.json(event)
  } catch (error) {
    return handleApiError(error, 'calendar.update')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.businessEvent.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'calendar.delete')
  }
}
