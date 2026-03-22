import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customers/[id]/timeline — 聚合時間軸
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params

  const [followUpLogs, visitRecords, callRecords, sampleRecords,
         quotations, salesOrders, complaints] = await Promise.all([
    prisma.followUpLog.findMany({
      where: { customerId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { logDate: 'desc' },
      take: 100,
    }),
    prisma.visitRecord.findMany({
      where: { customerId },
      include: { visitedBy: { select: { id: true, name: true } } },
      orderBy: { visitDate: 'desc' },
      take: 50,
    }),
    prisma.callRecord.findMany({
      where: { customerId },
      include: { calledBy: { select: { id: true, name: true } } },
      orderBy: { callDate: 'desc' },
      take: 50,
    }),
    prisma.sampleRecord.findMany({
      where: { customerId },
      include: { sentBy: { select: { id: true, name: true } } },
      orderBy: { sentDate: 'desc' },
      take: 30,
    }),
    prisma.quotation.findMany({
      where: { customerId },
      select: { id: true, quotationNo: true, status: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.salesOrder.findMany({
      where: { customerId },
      select: { id: true, orderNo: true, status: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.complaintRecord.findMany({
      where: { customerId },
      include: { reportedBy: { select: { id: true, name: true } } },
      orderBy: { complaintDate: 'desc' },
      take: 20,
    }),
  ])

  // 統一格式，加入 eventType 與 sortDate
  const timeline = [
    ...followUpLogs.map(l => ({
      id: l.id, eventType: 'followup' as const,
      date: l.logDate, actor: l.createdBy,
      title: `追蹤紀錄 — ${l.logType}`,
      summary: l.content,
      meta: { result: l.result, reaction: l.customerReaction, hasQuote: l.hasQuote, hasSample: l.hasSample, hasOrder: l.hasOrder },
    })),
    ...visitRecords.map(v => ({
      id: v.id, eventType: 'visit' as const,
      date: v.visitDate, actor: v.visitedBy,
      title: `拜訪紀錄 — ${v.visitMethod ?? '現場'}`,
      summary: v.content ?? v.purpose ?? '',
      meta: { result: v.result, nextVisitDate: v.nextVisitDate },
    })),
    ...callRecords.map(c => ({
      id: c.id, eventType: 'call' as const,
      date: c.callDate, actor: c.calledBy,
      title: '電訪紀錄',
      summary: c.content ?? '',
      meta: { result: c.result, duration: c.duration },
    })),
    ...sampleRecords.map(s => ({
      id: s.id, eventType: 'sample' as const,
      date: s.sentDate, actor: s.sentBy,
      title: '樣品寄送',
      summary: s.items,
      meta: { trackingNo: s.trackingNo, followUpDate: s.followUpDate },
    })),
    ...quotations.map(q => ({
      id: q.id, eventType: 'quotation' as const,
      date: q.createdAt, actor: null,
      title: `報價單 ${q.quotationNo}`,
      summary: `金額 ${q.totalAmount ? Number(q.totalAmount).toLocaleString() : '—'}`,
      meta: { status: q.status, amount: q.totalAmount },
    })),
    ...salesOrders.map(o => ({
      id: o.id, eventType: 'order' as const,
      date: o.createdAt, actor: null,
      title: `訂單 ${o.orderNo}`,
      summary: `金額 ${o.totalAmount ? Number(o.totalAmount).toLocaleString() : '—'}`,
      meta: { status: o.status, amount: o.totalAmount },
    })),
    ...complaints.map(c => ({
      id: c.id, eventType: 'complaint' as const,
      date: c.complaintDate, actor: c.reportedBy,
      title: `客訴 — ${c.type}`,
      summary: c.content,
      meta: { status: c.status, resolution: c.resolution },
    })),
  ]
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json(timeline)
}
