/**
 * 訂單頻率預測服務
 * 根據歷史訂單計算平均下單間隔，預測下次下單日
 */
import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'

export interface OrderPrediction {
  customerId: string
  orderCount: number
  avgDaysBetweenOrders: number
  lastOrderDate: Date | null
  predictedNextOrderDate: Date | null
  trend: 'GROWING' | 'DECLINING' | 'STABLE' | 'INSUFFICIENT_DATA'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.SIGNED, OrderStatus.COMPLETED,
]

export async function predictNextOrder(customerId: string): Promise<OrderPrediction> {
  const orders = await prisma.salesOrder.findMany({
    where: { customerId, status: { in: ACTIVE_ORDER_STATUSES } },
    orderBy: { orderDate: 'asc' },
    select: { orderDate: true, totalAmount: true },
  })

  const base: OrderPrediction = {
    customerId,
    orderCount: orders.length,
    avgDaysBetweenOrders: 0,
    lastOrderDate: null,
    predictedNextOrderDate: null,
    trend: 'INSUFFICIENT_DATA',
    confidence: 'LOW',
  }

  if (orders.length === 0) return base
  if (orders.length === 1) {
    return { ...base, lastOrderDate: orders[0].orderDate, trend: 'INSUFFICIENT_DATA' }
  }

  // Calculate all intervals
  const intervals: number[] = []
  for (let i = 1; i < orders.length; i++) {
    const diff = Math.round(
      (orders[i].orderDate.getTime() - orders[i - 1].orderDate.getTime()) / 86400000
    )
    if (diff > 0) intervals.push(diff)
  }

  if (intervals.length === 0) return { ...base, lastOrderDate: orders[orders.length - 1].orderDate }

  const avgDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)

  // Trend: compare last 2 intervals vs earlier ones
  let trend: OrderPrediction['trend'] = 'STABLE'
  if (intervals.length >= 4) {
    const recentAvg = (intervals[intervals.length - 1] + intervals[intervals.length - 2]) / 2
    const earlierAvg = intervals.slice(0, -2).reduce((a, b) => a + b, 0) / (intervals.length - 2)
    if (recentAvg < earlierAvg * 0.85) trend = 'GROWING'       // ordering more frequently
    else if (recentAvg > earlierAvg * 1.15) trend = 'DECLINING' // ordering less frequently
    else trend = 'STABLE'
  } else if (intervals.length >= 2) {
    trend = 'STABLE'
  }

  // Confidence based on data volume
  const confidence: OrderPrediction['confidence'] =
    orders.length >= 6 ? 'HIGH' :
    orders.length >= 3 ? 'MEDIUM' : 'LOW'

  const lastOrderDate = orders[orders.length - 1].orderDate
  const predictedNextOrderDate = new Date(lastOrderDate)
  predictedNextOrderDate.setDate(predictedNextOrderDate.getDate() + avgDays)

  return {
    customerId,
    orderCount: orders.length,
    avgDaysBetweenOrders: avgDays,
    lastOrderDate,
    predictedNextOrderDate,
    trend,
    confidence,
  }
}

/** 更新 CustomerDemandForecast 預測欄位 */
export async function updateOrderPrediction(customerId: string): Promise<OrderPrediction> {
  const result = await predictNextOrder(customerId)

  await prisma.customerDemandForecast.upsert({
    where: { customerId },
    update: {
      avgDaysBetweenOrders:  result.avgDaysBetweenOrders > 0 ? result.avgDaysBetweenOrders : undefined,
      predictedNextOrderDate: result.predictedNextOrderDate ?? undefined,
      last3OrdersTrend:      result.trend !== 'INSUFFICIENT_DATA' ? result.trend : undefined,
      analyticsUpdatedAt:    new Date(),
    },
    create: {
      customerId,
      avgDaysBetweenOrders:  result.avgDaysBetweenOrders > 0 ? result.avgDaysBetweenOrders : undefined,
      predictedNextOrderDate: result.predictedNextOrderDate ?? undefined,
      last3OrdersTrend:      result.trend !== 'INSUFFICIENT_DATA' ? result.trend : undefined,
      analyticsUpdatedAt:    new Date(),
    },
  })

  return result
}

// ── 拜訪頻率規則 ──────────────────────────────────────

export type VisitRole = 'SALES' | 'CARE_SUPERVISOR' | 'KEY_ACCOUNT'

export interface VisitDueInfo {
  customerId: string
  customerName: string
  customerCode: string
  grade: string | null
  lastVisitDate: Date | null
  daysOverdue: number
  requiredFrequencyDays: number
  visitRole: VisitRole
  isFirstOrder: boolean
  hasAnomaly: boolean
}

/** 計算業務員應拜訪的客戶（依頻率規則） */
export function getRequiredFrequencyDays(
  grade: string | null,
  visitRole: VisitRole,
  hasAnomaly: boolean
): number {
  if (hasAnomaly) return 0  // 即刻拜訪
  if (visitRole === 'CARE_SUPERVISOR') return 90  // 照顧督導：每季
  if (grade === 'A') return 14   // A 級：雙周
  if (grade === 'B') return 30   // B 級：每月
  return 30                       // 預設：每月
}

/** 取得指定業務員逾期未訪的客戶清單 */
export async function getOverdueVisits(salesRepId: string): Promise<VisitDueInfo[]> {
  const customers = await prisma.customer.findMany({
    where: { salesRepId, isActive: true },
    select: {
      id: true, name: true, code: true, grade: true,
      isKeyAccount: true,
    },
  })

  const customerIds = customers.map(c => c.id)

  // Fetch related data in bulk
  const [allOrders, allVisits, allComplaints] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { customerId: { in: customerIds }, status: { in: ACTIVE_ORDER_STATUSES } },
      orderBy: { orderDate: 'asc' },
      select: { customerId: true, id: true, orderDate: true },
    }),
    prisma.visitRecord.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { visitDate: 'desc' },
      select: { customerId: true, visitDate: true },
    }),
    prisma.complaintRecord.findMany({
      where: { customerId: { in: customerIds }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { customerId: true, id: true },
    }),
  ])

  // Build lookup maps
  const ordersByCustomer = new Map<string, typeof allOrders>()
  for (const o of allOrders) {
    const arr = ordersByCustomer.get(o.customerId) ?? []
    arr.push(o)
    ordersByCustomer.set(o.customerId, arr)
  }
  const lastVisitByCustomer = new Map<string, Date>()
  for (const v of allVisits) {
    if (!lastVisitByCustomer.has(v.customerId)) {
      lastVisitByCustomer.set(v.customerId, v.visitDate)
    }
  }
  const anomalyCustomers = new Set(allComplaints.map(c => c.customerId))

  const today = new Date()
  const results: VisitDueInfo[] = []

  for (const c of customers) {
    const visitRole: VisitRole = c.isKeyAccount ? 'KEY_ACCOUNT' : 'SALES'
    const hasAnomaly = anomalyCustomers.has(c.id)
    const customerOrders = ordersByCustomer.get(c.id) ?? []
    const isFirstOrder = customerOrders.length === 1  // only 1 order = first-sale
    const lastVisitDate = lastVisitByCustomer.get(c.id) ?? null
    const requiredFrequencyDays = getRequiredFrequencyDays(c.grade, visitRole, hasAnomaly)

    // 首次下單日（尚未有任何訂單的客戶不列入逾期計算）
    const firstOrderDate = customerOrders.length > 0
      ? customerOrders.reduce((earliest, o) =>
          o.orderDate < earliest ? o.orderDate : earliest, customerOrders[0].orderDate)
      : null

    let daysOverdue = 0
    if (hasAnomaly) {
      daysOverdue = 999  // 即刻拜訪
    } else if (lastVisitDate) {
      const daysSince = Math.round((today.getTime() - lastVisitDate.getTime()) / 86400000)
      daysOverdue = Math.max(0, daysSince - requiredFrequencyDays)
    } else if (firstOrderDate) {
      // 有下過單但從未被拜訪：從首次下單起算逾期
      const daysSinceFirstOrder = Math.round((today.getTime() - firstOrderDate.getTime()) / 86400000)
      daysOverdue = Math.max(0, daysSinceFirstOrder - requiredFrequencyDays)
    } else {
      // 從未下單的潛在客戶：不列入逾期（還在開發中）
      daysOverdue = 0
    }

    if (daysOverdue > 0 || hasAnomaly || isFirstOrder) {
      results.push({
        customerId: c.id,
        customerName: c.name,
        customerCode: c.code,
        grade: c.grade,
        lastVisitDate,
        daysOverdue,
        requiredFrequencyDays,
        visitRole,
        isFirstOrder,
        hasAnomaly,
      })
    }
  }

  // Sort: anomaly first, then most overdue
  return results.sort((a, b) => {
    if (a.hasAnomaly !== b.hasAnomaly) return a.hasAnomaly ? -1 : 1
    return b.daysOverdue - a.daysOverdue
  })
}
