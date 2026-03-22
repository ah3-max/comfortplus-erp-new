import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/notifications/generate - Scan system and create notifications
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400_000)
  const threeDaysLater = new Date(today.getTime() + 3 * 86400_000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400_000)

  const created: string[] = []

  // ── 1. Today Follow-ups ──
  const followupCustomers = await prisma.customer.findMany({
    where: {
      isActive: true,
      isFollowUp: true,
      nextFollowUpDate: { gte: today, lt: tomorrow },
    },
    select: { id: true, name: true, salesRepId: true },
  })
  for (const c of followupCustomers) {
    if (!c.salesRepId) continue
    await prisma.notification.upsert({
      where: { id: `followup-${c.id}-${today.toISOString().slice(0, 10)}` },
      create: {
        id: `followup-${c.id}-${today.toISOString().slice(0, 10)}`,
        userId: c.salesRepId,
        category: 'TODAY_FOLLOWUP',
        title: `今日追蹤：${c.name}`,
        relatedType: 'CUSTOMER',
        relatedId: c.id,
        linkUrl: `/customers/${c.id}`,
        priority: 'NORMAL',
      },
      update: {},
    })
    created.push('TODAY_FOLLOWUP')
  }

  // ── 2. Today Shipments (pending) ──
  const pendingShipments = await prisma.shipment.findMany({
    where: {
      status: 'PREPARING',
      shipDate: { gte: today, lt: tomorrow },
    },
    select: { id: true, shipmentNo: true, createdById: true },
  })
  for (const s of pendingShipments) {
    // Notify warehouse managers
    const whManagers = await prisma.user.findMany({
      where: { role: { in: ['WAREHOUSE_MANAGER', 'WAREHOUSE'] }, isActive: true },
      select: { id: true },
    })
    for (const u of whManagers) {
      await prisma.notification.upsert({
        where: { id: `shipment-${s.id}-${u.id}-${today.toISOString().slice(0, 10)}` },
        create: {
          id: `shipment-${s.id}-${u.id}-${today.toISOString().slice(0, 10)}`,
          userId: u.id,
          category: 'TODAY_SHIPMENT',
          title: `待出貨：${s.shipmentNo}`,
          relatedType: 'SHIPMENT',
          relatedId: s.id,
          linkUrl: `/shipments`,
          priority: 'HIGH',
        },
        update: {},
      })
    }
    created.push('TODAY_SHIPMENT')
  }

  // ── 3. Open Complaints needing response ──
  const openComplaints = await prisma.careIncident.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      severity: { in: ['HIGH', 'CRITICAL'] },
    },
    select: { id: true, incidentNo: true, issueSummary: true, assignedOwnerId: true, severity: true },
  })
  for (const c of openComplaints) {
    if (!c.assignedOwnerId) continue
    await prisma.notification.upsert({
      where: { id: `complaint-${c.id}-${today.toISOString().slice(0, 10)}` },
      create: {
        id: `complaint-${c.id}-${today.toISOString().slice(0, 10)}`,
        userId: c.assignedOwnerId,
        category: 'TODAY_COMPLAINT',
        title: `${c.severity === 'CRITICAL' ? '🔴' : '🟠'} 客訴待處理：${c.incidentNo}`,
        message: c.issueSummary,
        relatedType: 'INCIDENT',
        relatedId: c.id,
        linkUrl: `/incidents`,
        priority: c.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
      },
      update: {},
    })
    created.push('TODAY_COMPLAINT')
  }

  // ── 4. Stock Expiring (within 90 days) ──
  const expiringLots = await prisma.inventoryLot.findMany({
    where: {
      status: 'AVAILABLE',
      quantity: { gt: 0 },
      expiryDate: { lte: new Date(today.getTime() + 90 * 86400_000), gte: today },
    },
    select: { id: true, lotNo: true, productId: true, expiryDate: true, quantity: true, product: { select: { name: true, sku: true } } },
    take: 20,
  })
  if (expiringLots.length > 0) {
    const whManagers = await prisma.user.findMany({
      where: { role: 'WAREHOUSE_MANAGER', isActive: true },
      select: { id: true },
    })
    for (const u of whManagers) {
      await prisma.notification.upsert({
        where: { id: `expiring-${u.id}-${today.toISOString().slice(0, 10)}` },
        create: {
          id: `expiring-${u.id}-${today.toISOString().slice(0, 10)}`,
          userId: u.id,
          category: 'STOCK_EXPIRING',
          title: `效期預警：${expiringLots.length} 個批次即將到期`,
          message: expiringLots.slice(0, 5).map(l => `${l.product.sku} ${l.lotNo} (${l.quantity}件, 到期${l.expiryDate?.toISOString().slice(0, 10)})`).join('; '),
          linkUrl: '/inventory',
          priority: 'HIGH',
        },
        update: {},
      })
    }
    created.push('STOCK_EXPIRING')
  }

  // ── 5. AR Overdue ──
  const overdueAR = await prisma.accountsReceivable.findMany({
    where: {
      status: { in: ['DUE', 'PARTIAL_PAID'] },
      dueDate: { lt: today },
    },
    select: { id: true, customerId: true, amount: true, paidAmount: true, dueDate: true, customer: { select: { name: true, salesRepId: true } } },
  })
  // Group by salesRep and notify
  const arBySalesRep = new Map<string, typeof overdueAR>()
  for (const ar of overdueAR) {
    const repId = ar.customer.salesRepId
    if (!repId) continue
    const list = arBySalesRep.get(repId) ?? []
    list.push(ar)
    arBySalesRep.set(repId, list)
  }
  for (const [repId, arList] of arBySalesRep) {
    const totalOverdue = arList.reduce((s, a) => s + Number(a.amount) - Number(a.paidAmount), 0)
    await prisma.notification.upsert({
      where: { id: `ar-overdue-${repId}-${today.toISOString().slice(0, 10)}` },
      create: {
        id: `ar-overdue-${repId}-${today.toISOString().slice(0, 10)}`,
        userId: repId,
        category: 'SYSTEM_ALERT',
        title: `應收逾期：${arList.length} 筆，共 $${Math.round(totalOverdue).toLocaleString()}`,
        linkUrl: '/payments',
        priority: totalOverdue > 500000 ? 'URGENT' : 'HIGH',
      },
      update: {},
    })
    created.push('AR_OVERDUE')
  }

  // Notify finance team too
  const financeUsers = await prisma.user.findMany({
    where: { role: 'FINANCE', isActive: true },
    select: { id: true },
  })
  if (overdueAR.length > 0) {
    const totalOverdue = overdueAR.reduce((s, a) => s + Number(a.amount) - Number(a.paidAmount), 0)
    for (const u of financeUsers) {
      await prisma.notification.upsert({
        where: { id: `ar-overdue-fin-${u.id}-${today.toISOString().slice(0, 10)}` },
        create: {
          id: `ar-overdue-fin-${u.id}-${today.toISOString().slice(0, 10)}`,
          userId: u.id,
          category: 'SYSTEM_ALERT',
          title: `應收逾期總計：${overdueAR.length} 筆 $${Math.round(totalOverdue).toLocaleString()}`,
          linkUrl: '/payments',
          priority: 'HIGH',
        },
        update: {},
      })
    }
  }

  // ── 6. Universal: Pending Quotations (for current user or any ADMIN/SALES) ──
  const pendingQuotations = await prisma.quotation.count({
    where: { status: { in: ['DRAFT', 'SENT'] } },
  })
  if (pendingQuotations > 0) {
    await prisma.notification.upsert({
      where: { id: `pending-quotations-${session.user.id}-${today.toISOString().slice(0, 10)}` },
      create: {
        id: `pending-quotations-${session.user.id}-${today.toISOString().slice(0, 10)}`,
        userId: session.user.id,
        category: 'SYSTEM_ALERT',
        title: `待確認報價單：${pendingQuotations} 筆`,
        linkUrl: '/quotations',
        priority: 'NORMAL',
      },
      update: {},
    })
    created.push('PENDING_QUOTATIONS')
  }

  // ── 7. Universal: Pending Sales Orders ──
  const pendingOrders = await prisma.salesOrder.count({
    where: { status: { in: ['PENDING', 'CONFIRMED', 'ALLOCATING'] } },
  })
  if (pendingOrders > 0) {
    await prisma.notification.upsert({
      where: { id: `pending-orders-${session.user.id}-${today.toISOString().slice(0, 10)}` },
      create: {
        id: `pending-orders-${session.user.id}-${today.toISOString().slice(0, 10)}`,
        userId: session.user.id,
        category: 'SYSTEM_ALERT',
        title: `進行中訂單：${pendingOrders} 筆待處理`,
        linkUrl: '/orders',
        priority: 'NORMAL',
      },
      update: {},
    })
    created.push('PENDING_ORDERS')
  }

  return NextResponse.json({
    generated: created.length,
    categories: [...new Set(created)],
    generatedAt: now.toISOString(),
  })
}
