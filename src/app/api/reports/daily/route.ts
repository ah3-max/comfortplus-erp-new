import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const localStart = new Date(dateStr + 'T00:00:00+08:00')
  const localEnd   = new Date(dateStr + 'T23:59:59+08:00')

  // Yesterday (the day before the requested date)
  const prevDate = new Date(localStart)
  prevDate.setDate(prevDate.getDate() - 1)
  const yesterdayStart = new Date(prevDate.toISOString().slice(0, 10) + 'T00:00:00+08:00')
  const yesterdayEnd   = new Date(prevDate.toISOString().slice(0, 10) + 'T23:59:59+08:00')

  const [
    followUpLogs,
    newCustomers,
    quotations,
    salesOrders,
    shipments,
    completedTasks,
    sampleRecords,
    payments,
    yesterdayOrders,
    yesterdayLogs,
  ] = await Promise.all([
    // All follow-up logs created today
    prisma.followUpLog.findMany({
      where: { logDate: { gte: localStart, lte: localEnd } },
      include: {
        customer:  { select: { id: true, name: true, code: true, devStatus: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { logDate: 'asc' },
    }),

    // New customers created today (including cold-call prospects)
    prisma.customer.findMany({
      where: { createdAt: { gte: localStart, lte: localEnd } },
      select: {
        id: true, name: true, code: true, type: true, source: true,
        devStatus: true, phone: true,
        salesRep: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),

    // Quotations created today
    prisma.quotation.findMany({
      where: { createdAt: { gte: localStart, lte: localEnd } },
      select: {
        id: true, quotationNo: true, status: true, totalAmount: true, createdAt: true,
        customer:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    // Sales orders created today
    prisma.salesOrder.findMany({
      where: { createdAt: { gte: localStart, lte: localEnd } },
      select: {
        id: true, orderNo: true, status: true, totalAmount: true, createdAt: true,
        customer:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    // Shipments going out today
    prisma.shipment.findMany({
      where: { shipDate: { gte: localStart, lte: localEnd } },
      select: {
        id: true, trackingNo: true, status: true, shipDate: true,
        order: {
          select: {
            id: true, orderNo: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { shipDate: 'asc' },
    }),

    // Tasks completed today
    prisma.salesTask.findMany({
      where: { completedAt: { gte: localStart, lte: localEnd }, status: 'DONE' },
      select: {
        id: true, title: true, taskType: true, completedAt: true,
        assignedTo: { select: { id: true, name: true } },
        customer:   { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'asc' },
    }),

    // Samples sent today
    prisma.sampleRecord.findMany({
      where: { sentDate: { gte: localStart, lte: localEnd } },
      select: {
        id: true, items: true, quantity: true, sentDate: true,
        customer: { select: { id: true, name: true } },
        sentBy:   { select: { id: true, name: true } },
      },
      orderBy: { sentDate: 'asc' },
    }),

    // Payments recorded today
    prisma.paymentRecord.findMany({
      where: { paymentDate: { gte: localStart, lte: localEnd } },
      select: {
        id: true, amount: true, direction: true, paymentType: true, paymentDate: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: 'asc' },
    }),

    // ── Yesterday comparison queries ──────────────────────
    // Yesterday's orders count & revenue
    prisma.salesOrder.findMany({
      where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      select: { totalAmount: true },
    }),

    // Yesterday's follow-up logs (for visits & calls)
    prisma.followUpLog.findMany({
      where: { logDate: { gte: yesterdayStart, lte: yesterdayEnd } },
      select: { logType: true },
    }),
  ])

  // ── Build per-rep summary ────────────────────────────
  type RepEntry = {
    rep: { id: string; name: string; role: string }
    logs: typeof followUpLogs
    newCustomers: typeof newCustomers
    quotations: typeof quotations
    orders: typeof salesOrders
    samples: typeof sampleRecords
    completedTasks: typeof completedTasks
  }

  const repMap = new Map<string, RepEntry>()

  function getRepEntry(repId: string, repInfo: { id: string; name: string; role: string }): RepEntry {
    if (!repMap.has(repId)) {
      repMap.set(repId, {
        rep: repInfo,
        logs: [],
        newCustomers: [],
        quotations: [],
        orders: [],
        samples: [],
        completedTasks: [],
      })
    }
    return repMap.get(repId)!
  }

  for (const log of followUpLogs) {
    const r = log.createdBy
    getRepEntry(r.id, r).logs.push(log)
  }
  for (const c of newCustomers) {
    if (c.salesRep) {
      getRepEntry(c.salesRep.id, { ...c.salesRep, role: '' }).newCustomers.push(c)
    }
  }
  for (const q of quotations) {
    getRepEntry(q.createdBy.id, { ...q.createdBy, role: '' }).quotations.push(q)
  }
  for (const o of salesOrders) {
    getRepEntry(o.createdBy.id, { ...o.createdBy, role: '' }).orders.push(o)
  }
  for (const s of sampleRecords) {
    getRepEntry(s.sentBy.id, { ...s.sentBy, role: '' }).samples.push(s)
  }
  for (const t of completedTasks) {
    if (t.assignedTo) {
      getRepEntry(t.assignedTo.id, { ...t.assignedTo, role: '' }).completedTasks.push(t)
    }
  }

  const VISIT_TYPES = ['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'MEETING']

  const repSummaries = Array.from(repMap.values()).map(entry => ({
    rep:             entry.rep,
    logCount:        entry.logs.length,
    callCount:       entry.logs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length,
    visitCount:      entry.logs.filter(l => VISIT_TYPES.includes(l.logType)).length,
    newCustomers:    entry.newCustomers.length,
    quotations:      entry.quotations.length,
    quotationAmount: entry.quotations.reduce((s, q) => s + Number(q.totalAmount), 0),
    orders:          entry.orders.length,
    orderAmount:     entry.orders.reduce((s, o) => s + Number(o.totalAmount), 0),
    samples:         entry.samples.length,
    completedTasks:  entry.completedTasks.length,
    logs:            entry.logs,
  }))

  // ── Totals ───────────────────────────────────────────
  const totalIncoming = payments
    .filter(p => p.direction === 'INCOMING')
    .reduce((s, p) => s + Number(p.amount), 0)
  const totalOutgoing = payments
    .filter(p => p.direction === 'OUTGOING')
    .reduce((s, p) => s + Number(p.amount), 0)

  // ── Yesterday comparison ────────────────────────────
  const VISIT_TYPES_Y = ['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'MEETING']
  const yesterdayOrderCount   = yesterdayOrders.length
  const yesterdayRevenue      = yesterdayOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
  const yesterdayVisitCount   = yesterdayLogs.filter(l => VISIT_TYPES_Y.includes(l.logType)).length
  const yesterdayCallCount    = yesterdayLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length

  const comparison = {
    yesterdayOrders:  yesterdayOrderCount,
    yesterdayRevenue: yesterdayRevenue,
    yesterdayVisits:  yesterdayVisitCount,
    yesterdayCalls:   yesterdayCallCount,
    orderChange:     salesOrders.length - yesterdayOrderCount,
    revenueChange:   salesOrders.reduce((s, o) => s + Number(o.totalAmount), 0) - yesterdayRevenue,
  }

  return NextResponse.json({
    date:        dateStr,
    generatedAt: new Date().toISOString(),
    summary: {
      totalLogs:         followUpLogs.length,
      totalCalls:        followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length,
      totalVisits:       followUpLogs.filter(l => VISIT_TYPES.includes(l.logType)).length,
      newCustomers:      newCustomers.length,
      coldCallProspects: newCustomers.filter(c => c.source === 'COLD_CALL').length,
      quotations:        quotations.length,
      quotationAmount:   quotations.reduce((s, q) => s + Number(q.totalAmount), 0),
      orders:            salesOrders.length,
      orderAmount:       salesOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
      shipments:         shipments.length,
      samples:           sampleRecords.length,
      completedTasks:    completedTasks.length,
      incomingPayments:  totalIncoming,
      outgoingPayments:  totalOutgoing,
    },
    comparison,
    repSummaries,
    details: {
      followUpLogs,
      newCustomers,
      quotations,
      salesOrders,
      shipments,
      sampleRecords,
      completedTasks,
      payments,
    },
  })
}
