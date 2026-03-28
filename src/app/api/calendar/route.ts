import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// Map simplified UI event types → DB enum
const EVENT_TYPE_MAP: Record<string, string> = {
  MEETING:    'WEEKLY_ADMIN',
  VISIT:      'OTHER',
  DELIVERY:   'CHANNEL_PROMO',
  PRODUCTION: 'MAJOR_PROMO',
  HOLIDAY:    'OTHER',
  OTHER:      'OTHER',
}

// Color per UI event type
const EVENT_TYPE_COLOR: Record<string, string> = {
  MEETING:    '#6366f1',
  VISIT:      '#3b82f6',
  DELIVERY:   '#f59e0b',
  PRODUCTION: '#8b5cf6',
  HOLIDAY:    '#ef4444',
  OTHER:      '#64748b',
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    // Support both ?month=YYYY-MM and ?year=YYYY&month=M
    const monthParam = searchParams.get('month')
    let year: number
    let month: number

    if (monthParam && monthParam.includes('-')) {
      const parts = monthParam.split('-')
      year  = Number(parts[0])
      month = Number(parts[1])
    } else {
      year  = Number(searchParams.get('year')  ?? new Date().getFullYear())
      month = Number(searchParams.get('month') ?? new Date().getMonth() + 1)
    }

    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month, 0, 23, 59, 59)

    const [visits, calls, tasks, careSchedules, salesSchedules, bizEvents] = await Promise.all([
      prisma.visitRecord.findMany({
        where: { visitDate: { gte: start, lte: end } },
        include: {
          customer:  { select: { id: true, name: true } },
          visitedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.callRecord.findMany({
        where: { callDate: { gte: start, lte: end } },
        include: {
          customer: { select: { id: true, name: true } },
          calledBy: { select: { id: true, name: true } },
        },
      }),
      prisma.salesTask.findMany({
        where: {
          dueDate: { gte: start, lte: end },
          status: { notIn: ['CANCELLED'] },
        },
        include: {
          customer:   { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.careSchedule.findMany({
        where: { scheduleDate: { gte: start, lte: end } },
        include: {
          customer:   { select: { id: true, name: true } },
          supervisor: { select: { id: true, name: true } },
        },
      }),
      prisma.salesSchedule.findMany({
        where: { scheduleDate: { gte: start, lte: end } },
        include: {
          customer: { select: { id: true, name: true } },
          salesRep: { select: { id: true, name: true } },
        },
      }),
      prisma.businessEvent.findMany({
        where: { startDate: { gte: start, lte: end } },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { startDate: 'asc' },
      }),
    ])

    const SCHED_LABEL: Record<string, string> = {
      FIRST_VISIT: '初訪', SECOND_VISIT: '二訪', THIRD_VISIT: '三訪',
      PAYMENT_COLLECT: '收款拜訪', DELIVERY: '送貨', EXPO: '擺攤',
      SPRING_PARTY: '春酒活動', RECONCILE: '對帳', OTHER: '行程',
    }

    type CalEvent = {
      id: string; date: string; type: 'visit' | 'call' | 'task' | 'care' | 'schedule' | 'biz'
      title: string; customer: string | null; user: string; color: string
      status?: string; priority?: string
      // Extended fields for BusinessEvent (editable events)
      eventType?: string; startTime?: string; endDate?: string; endTime?: string
      description?: string; isAllDay?: boolean; isEditable?: boolean
    }

    const events: CalEvent[] = [
      ...visits.map(v => ({
        id:       v.id,
        date:     v.visitDate.toISOString().substring(0, 10),
        type:     'visit' as const,
        title:    v.purpose ?? '客戶拜訪',
        customer: v.customer.name,
        user:     v.visitedBy.name,
        color:    '#3b82f6',
      })),
      ...calls.map(c => ({
        id:       c.id,
        date:     c.callDate.toISOString().substring(0, 10),
        type:     'call' as const,
        title:    c.purpose ?? '電訪',
        customer: c.customer.name,
        user:     c.calledBy.name,
        color:    '#8b5cf6',
      })),
      ...tasks.map(t => ({
        id:       t.id,
        date:     t.dueDate!.toISOString().substring(0, 10),
        type:     'task' as const,
        title:    t.title,
        customer: t.customer?.name ?? null,
        user:     t.assignedTo.name,
        color:    t.priority === 'URGENT' ? '#ef4444' : t.priority === 'HIGH' ? '#f59e0b' : '#10b981',
        status:   t.status,
        priority: t.priority,
      })),
      ...careSchedules.map(cs => ({
        id:       cs.id,
        date:     cs.scheduleDate.toISOString().substring(0, 10),
        type:     'care' as const,
        title:    cs.purpose ?? '督導拜訪',
        customer: cs.customer.name,
        user:     cs.supervisor.name,
        color:    '#14b8a6',
        status:   cs.status,
      })),
      ...salesSchedules.map(s => ({
        id:       `sch-${s.id}`,
        date:     s.scheduleDate.toISOString().substring(0, 10),
        type:     'schedule' as const,
        title:    SCHED_LABEL[s.scheduleType] ?? '業務行程',
        customer: s.customer.name,
        user:     s.salesRep.name,
        color:    s.isCompleted ? '#94a3b8' : '#f59e0b',
        status:   s.isCompleted ? 'DONE' : 'PENDING',
      })),
      // User-created BusinessEvent records
      ...bizEvents.map(be => {
        const uiType = (be.tags?.[0] as string) ?? 'OTHER'
        const color  = EVENT_TYPE_COLOR[uiType] ?? '#64748b'
        const startIso = be.startDate.toISOString()
        const endIso   = be.endDate.toISOString()
        return {
          id:          be.id,
          date:        startIso.substring(0, 10),
          type:        'biz' as const,
          title:       be.title,
          customer:    null,
          user:        be.owner.name,
          color,
          status:      be.status,
          // Extra fields for edit dialog
          eventType:   uiType,
          startTime:   be.allDay ? '' : startIso.substring(11, 16),
          endDate:     endIso.substring(0, 10),
          endTime:     be.allDay ? '' : endIso.substring(11, 16),
          description: be.notes ?? '',
          isAllDay:    be.allDay,
          isEditable:  true,
        }
      }),
    ]

    events.sort((a, b) => a.date.localeCompare(b.date))
    return NextResponse.json(events)
  } catch (error) {
    return handleApiError(error, 'calendar.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, eventType, startDate, startTime, endDate, endTime, description, isAllDay } = body

    if (!title?.trim()) return NextResponse.json({ error: '標題為必填' }, { status: 400 })
    if (!startDate)      return NextResponse.json({ error: '開始日期為必填' }, { status: 400 })

    // Build datetime values
    const startDatetime = isAllDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime || '00:00'}:00`)

    const endDatetime = endDate
      ? (isAllDay
          ? new Date(`${endDate}T23:59:59`)
          : new Date(`${endDate}T${endTime || '23:59'}:00`))
      : startDatetime

    const dbEventType = EVENT_TYPE_MAP[eventType ?? 'OTHER'] ?? 'OTHER'

    // Generate event number manually (no sequence table entry for BE)
    const today = new Date()
    const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const count = await prisma.businessEvent.count()
    const eventNo = `BE-${datePart}-${String(count + 1).padStart(4, '0')}`

    const event = await prisma.businessEvent.create({
      data: {
        eventNo,
        title:       title.trim(),
        eventType:   dbEventType as never,
        startDate:   startDatetime,
        endDate:     endDatetime,
        allDay:      Boolean(isAllDay),
        notes:       description ?? null,
        tags:        [eventType ?? 'OTHER'],
        ownerUserId: session.user.id,
        createdById: session.user.id,
      },
      include: { owner: { select: { name: true } } },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'calendar.create')
  }
}
