import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year')  ?? new Date().getFullYear())
  const month = Number(searchParams.get('month') ?? new Date().getMonth() + 1)

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const [visits, calls, tasks, careSchedules, salesSchedules] = await Promise.all([
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
  ])

  const SCHED_LABEL: Record<string, string> = {
    FIRST_VISIT: '初訪', SECOND_VISIT: '二訪', THIRD_VISIT: '三訪',
    PAYMENT_COLLECT: '收款拜訪', DELIVERY: '送貨', EXPO: '擺攤',
    SPRING_PARTY: '春酒活動', RECONCILE: '對帳', OTHER: '行程',
  }

  // Normalize to calendar events
  type CalEvent = {
    id: string; date: string; type: 'visit' | 'call' | 'task' | 'care' | 'schedule'
    title: string; customer: string | null; user: string; color: string
    status?: string; priority?: string
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
  ]

  events.sort((a, b) => a.date.localeCompare(b.date))
  return NextResponse.json(events)
}
