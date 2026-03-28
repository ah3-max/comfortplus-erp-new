import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notify, notifyManagers } from '@/lib/notify'
import { refreshExpiryStatus } from '@/app/api/inventory/lots/refresh-expiry/route'

/**
 * GET /api/cron — Scheduled tasks runner
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *   curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3001/api/cron
 *
 * Idempotent: safe to call multiple times per day
 * Each task is independent — one failure won't stop others
 */
export async function GET(req: NextRequest) {
  // ── Auth: CRON_SECRET via Bearer token ──
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    // Also support ?key= for backward compat
    const queryKey = new URL(req.url).searchParams.get('key')
    if (token !== cronSecret && queryKey !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results: Record<string, { status: 'ok' | 'error'; data?: unknown; error?: string }> = {}
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // ── Task 1: Expire quotations (idempotent — only updates non-EXPIRED) ──
  try {
    const expired = await prisma.quotation.updateMany({
      where: {
        status: { in: ['DRAFT', 'SENT', 'PENDING_APPROVAL', 'APPROVED'] },
        validUntil: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    // Only notify for newly expired today (idempotent — won't re-notify)
    if (expired.count > 0) {
      const expiredList = await prisma.quotation.findMany({
        where: { status: 'EXPIRED', validUntil: { gte: new Date(now.getTime() - 86400000), lt: now } },
        select: { createdById: true, quotationNo: true, customer: { select: { name: true } } },
      })

      // Check if we already notified today
      const byUser: Record<string, string[]> = {}
      for (const q of expiredList) {
        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId: q.createdById,
            category: 'QUOTATION_EXPIRED',
            createdAt: { gte: todayStart },
          },
        })
        if (!alreadyNotified) {
          if (!byUser[q.createdById]) byUser[q.createdById] = []
          byUser[q.createdById].push(`${q.quotationNo}（${q.customer.name}）`)
        }
      }

      for (const [userId, quotes] of Object.entries(byUser)) {
        await notify({
          userIds: [userId],
          title: `⏰ ${quotes.length} 份報價已過期`,
          message: quotes.join('\n'),
          linkUrl: '/quotations?status=EXPIRED',
          category: 'QUOTATION_EXPIRED',
        })
      }
    }
    results.expireQuotations = { status: 'ok', data: { count: expired.count } }
  } catch (e) {
    results.expireQuotations = { status: 'error', error: (e as Error).message }
  }

  // ── Task 2: Quotation expiring soon (3 days) — idempotent ──
  try {
    const threeDaysLater = new Date(now.getTime() + 3 * 86400000)
    const expiringSoon = await prisma.quotation.findMany({
      where: {
        status: { in: ['SENT', 'APPROVED'] },
        validUntil: { gte: now, lte: threeDaysLater },
      },
      select: { createdById: true, quotationNo: true, validUntil: true, customer: { select: { name: true } } },
    })

    const byUser: Record<string, string[]> = {}
    for (const q of expiringSoon) {
      // Check if already notified today
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: q.createdById,
          category: 'QUOTATION_EXPIRING',
          createdAt: { gte: todayStart },
        },
      })
      if (!alreadyNotified) {
        if (!byUser[q.createdById]) byUser[q.createdById] = []
        const days = Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / 86400000)
        byUser[q.createdById].push(`${q.quotationNo}（${q.customer.name}）— ${days} 天後到期`)
      }
    }

    for (const [userId, quotes] of Object.entries(byUser)) {
      await notify({
        userIds: [userId],
        title: `📋 ${quotes.length} 份報價即將到期`,
        message: quotes.join('\n'),
        linkUrl: '/quotations?status=SENT',
        category: 'QUOTATION_EXPIRING',
      })
    }
    results.expiringSoon = { status: 'ok', data: { count: expiringSoon.length } }
  } catch (e) {
    results.expiringSoon = { status: 'error', error: (e as Error).message }
  }

  // ── Task 3: Low stock alerts — idempotent ──
  try {
    const lowStockItems = await prisma.$queryRaw<Array<{
      productId: string; name: string; sku: string; quantity: number; safetyStock: number
    }>>`
      SELECT i."productId", p.name, p.sku, i.quantity, i."safetyStock"
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity <= i."safetyStock" AND i.quantity > 0 AND p."isActive" = true
      ORDER BY (i.quantity::float / NULLIF(i."safetyStock", 0)) ASC
      LIMIT 20
    `

    if (lowStockItems.length > 0) {
      // Check if already notified today
      const alreadyNotified = await prisma.notification.findFirst({
        where: { category: 'INVENTORY_LOW', createdAt: { gte: todayStart } },
      })
      if (!alreadyNotified) {
        await notifyManagers({
          line: true,
          title: `⚠️ ${lowStockItems.length} 個商品低庫存`,
          message: lowStockItems.slice(0, 10).map(i =>
            `• ${i.name}（${i.sku}）：${i.quantity}/${i.safetyStock}`
          ).join('\n'),
          linkUrl: '/inventory',
          category: 'INVENTORY_LOW',
          priority: 'HIGH',
        })
      }
    }
    results.lowStock = { status: 'ok', data: { count: lowStockItems.length } }
  } catch (e) {
    results.lowStock = { status: 'error', error: (e as Error).message }
  }

  // ── Task 4: Overdue receivables — idempotent ──
  try {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000)
    const overdueOrders = await prisma.salesOrder.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'DRAFT'] },
        createdAt: { lt: sixtyDaysAgo },
      },
      select: { totalAmount: true, paidAmount: true },
    })
    const overdueAmount = overdueOrders.reduce(
      (s, o) => s + Math.max(0, Number(o.totalAmount) - Number(o.paidAmount)), 0
    )
    const overdueCount = overdueOrders.filter(o => Number(o.totalAmount) > Number(o.paidAmount)).length

    if (overdueCount > 0) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: { category: 'FINANCE_OVERDUE', createdAt: { gte: todayStart } },
      })
      if (!alreadyNotified) {
        const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
        await notifyManagers({
          title: `💰 ${overdueCount} 筆逾期帳款`,
          message: `逾期 60 天以上未收款：${fmt(overdueAmount)}`,
          linkUrl: '/ar-aging',
          category: 'FINANCE_OVERDUE',
          priority: 'HIGH',
        })
      }
    }
    results.overdueReceivables = { status: 'ok', data: { count: overdueCount, amount: overdueAmount } }
  } catch (e) {
    results.overdueReceivables = { status: 'error', error: (e as Error).message }
  }

  // ══════════════════════════════════════════════════
  //  車輛到期檢查推播
  // ══════════════════════════════════════════════════
  try {
    const warn30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const vehicles = await prisma.vehicle.findMany({ where: { isActive: true } })
    let alertCount = 0

    for (const v of vehicles) {
      const alerts: string[] = []
      if (v.insuranceExpiry && v.insuranceExpiry < warn30) alerts.push(`保險${v.insuranceExpiry < now ? '已過期' : '即將到期'}(${v.insuranceExpiry.toISOString().slice(0, 10)})`)
      if (v.inspectionExpiry && v.inspectionExpiry < warn30) alerts.push(`驗車${v.inspectionExpiry < now ? '已過期' : '即將到期'}(${v.inspectionExpiry.toISOString().slice(0, 10)})`)
      if (v.licenseTaxExpiry && v.licenseTaxExpiry < warn30) alerts.push(`牌照稅${v.licenseTaxExpiry < now ? '已過期' : '即將到期'}(${v.licenseTaxExpiry.toISOString().slice(0, 10)})`)
      if (v.fuelTaxExpiry && v.fuelTaxExpiry < warn30) alerts.push(`燃料稅${v.fuelTaxExpiry < now ? '已過期' : '即將到期'}(${v.fuelTaxExpiry.toISOString().slice(0, 10)})`)

      // 保養到期
      const latestMaint = await prisma.vehicleMaintenance.findFirst({
        where: { vehicleId: v.id },
        orderBy: { serviceDate: 'desc' },
      })
      if (latestMaint?.nextServiceDate && latestMaint.nextServiceDate < warn30) {
        alerts.push(`定期保養${latestMaint.nextServiceDate < now ? '已逾期' : '即將到期'}(${latestMaint.nextServiceDate.toISOString().slice(0, 10)})`)
      }

      if (alerts.length > 0) {
        alertCount++
        await notifyManagers({
          title: `車輛 ${v.plateNo} 有 ${alerts.length} 項待處理`,
          message: alerts.join('、'),
          linkUrl: '/logistics',
          category: 'VEHICLE_ALERT',
          priority: alerts.some(a => a.includes('已過期') || a.includes('已逾期')) ? 'URGENT' : 'HIGH',
        })
      }
    }
    results.vehicleAlerts = { status: 'ok', data: { checked: vehicles.length, alerted: alertCount } }
  } catch (e) {
    results.vehicleAlerts = { status: 'error', error: (e as Error).message }
  }

  // ── Task: Refresh inventory lot expiry status ──
  try {
    const expiryRes = await refreshExpiryStatus()
    const expiryData = await expiryRes.json()
    // Notify managers about expired/near-expiry lots
    const expiredLots = await prisma.inventoryLot.findMany({
      where: { isExpired: true, status: { not: 'SCRAPPED' } },
      include: { product: { select: { name: true, sku: true } } },
      take: 10,
    })
    if (expiredLots.length > 0) {
      await notifyManagers({
        title: `⛔ ${expiredLots.length} 個批次已過期`,
        message: expiredLots.map(l => `${l.product.name} (${l.lotNo})`).join('、'),
        linkUrl: '/expiry-tracking',
        category: 'INVENTORY_ALERT',
        priority: 'URGENT',
      }).catch(() => {})
    }
    const nearExpiryLots = await prisma.inventoryLot.findMany({
      where: { isNearExpiry: true, isExpired: false, status: { not: 'SCRAPPED' }, daysToExpiry: { lte: 30 } },
      include: { product: { select: { name: true } } },
      take: 10,
    })
    if (nearExpiryLots.length > 0) {
      await notifyManagers({
        title: `⚠ ${nearExpiryLots.length} 個批次 30 天內到期`,
        message: nearExpiryLots.map(l => `${l.product.name}(${l.daysToExpiry}天)`).join('、'),
        linkUrl: '/expiry-tracking',
        category: 'INVENTORY_ALERT',
        priority: 'HIGH',
      }).catch(() => {})
    }
    results.expiryRefresh = { status: 'ok', data: expiryData }
  } catch (e) {
    results.expiryRefresh = { status: 'error', error: (e as Error).message }
  }

  return NextResponse.json({
    ok: Object.values(results).every(r => r.status === 'ok'),
    timestamp: now.toISOString(),
    results,
  })
}
