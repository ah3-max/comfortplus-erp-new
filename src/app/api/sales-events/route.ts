import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const customerId    = searchParams.get('customerId')
    const assignedToId  = searchParams.get('assignedToId')
    const eventType     = searchParams.get('eventType')
    const from          = searchParams.get('from')
    const to            = searchParams.get('to')
    const isCompleted   = searchParams.get('isCompleted')

    const events = await prisma.salesEvent.findMany({
      where: {
        ...(customerId   ? { customerId }   : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(eventType    ? { eventType: eventType as never } : {}),
        ...(isCompleted !== null ? { isCompleted: isCompleted === 'true' } : {}),
        ...(from || to ? {
          eventDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      include: {
        customer:   { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy:  { select: { id: true, name: true } },
      },
      orderBy: { eventDate: 'desc' },
    })

    return NextResponse.json(events)
  } catch (error) {
    return handleApiError(error, 'sales-events.GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      eventType, eventDate, customerId, items, quantity, amount, assignedToId, notes,
    } = body

    if (!customerId || !eventDate || !assignedToId) {
      return NextResponse.json({ error: '客戶、事件日期、負責人為必填' }, { status: 400 })
    }

    const event = await prisma.salesEvent.create({
      data: {
        eventType:    eventType    ?? 'OTHER',
        eventDate:    new Date(eventDate),
        customerId,
        items:        items        ?? null,
        quantity:     quantity     ?? null,
        amount:       amount       ?? null,
        assignedToId,
        notes:        notes        ?? null,
        createdById:  session.user.id,
      },
      include: {
        customer:   { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'sales-events.POST')
  }
}
