import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// ── Types ──────────────────────────────────────────────────────────────────

interface ChurnAlert {
  customerId: string
  customerName: string
  customerCode: string
  salesRep: { id: string; name: string } | null
  // Risk signals
  daysSinceLastOrder: number | null
  lastOrderDate: string | null
  lastOrderAmount: number
  // Volume comparison (recent 60d vs prior 60d)
  recentVolume: number       // TWD in last 60 days
  priorVolume: number        // TWD in 60 days before that
  volumeChangePercent: number // negative = decline
  recentOrderCount: number
  priorOrderCount: number
  // Engagement signals
  daysSinceLastContact: number | null
  hasOverdueFollowUp: boolean
  // Composite score 0–100 (higher = more at risk)
  churnRiskScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskFactors: string[]
}

// ── GET /api/crm/churn-alerts ──────────────────────────────────────────────
// Comprehensive churn prediction engine
// Detects: no-order, volume decline, engagement drop

export async function GET(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d60ago  = new Date(today.getTime() - 60  * 86400_000)
  const d120ago = new Date(today.getTime() - 120 * 86400_000)
  const d30ago  = new Date(today.getTime() - 30  * 86400_000)

  // ── 1. Find all active customers that have ever ordered ──────────────────
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      devStatus: { in: ['CLOSED', 'STABLE_REPURCHASE', 'TRIAL'] },
      salesOrders: { some: {} },
    },
    select: {
      id: true,
      name: true,
      code: true,
      devStatus: true,
      lastContactDate: true,
      nextFollowUpDate: true,
      estimatedMonthlyVolume: true,
      salesRep: { select: { id: true, name: true } },
    },
  })

  if (customers.length === 0) {
    return NextResponse.json({ alerts: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } })
  }

  // ── 2. Batch-fetch order data for all customers ──────────────────────────

  const customerIds = customers.map(c => c.id)

  // Last order per customer
  const allOrders = await prisma.salesOrder.findMany({
    where: {
      customerId: { in: customerIds },
      status: { notIn: ['CANCELLED', 'DRAFT'] },
    },
    select: {
      customerId: true,
      orderDate: true,
      totalAmount: true,
      createdAt: true,
    },
    orderBy: { orderDate: 'desc' },
  })

  // Group orders by customer
  const ordersByCustomer = new Map<string, typeof allOrders>()
  for (const o of allOrders) {
    const list = ordersByCustomer.get(o.customerId) ?? []
    list.push(o)
    ordersByCustomer.set(o.customerId, list)
  }

  // ── 3. Calculate risk for each customer ──────────────────────────────────

  const alerts: ChurnAlert[] = []

  for (const c of customers) {
    const orders = ordersByCustomer.get(c.id) ?? []
    if (orders.length === 0) continue

    const lastOrder = orders[0]
    const lastOrderDate = new Date(lastOrder.orderDate)
    const daysSinceLastOrder = Math.floor((today.getTime() - lastOrderDate.getTime()) / 86400_000)

    // ── Volume comparison: recent 60d vs prior 60d ─────────────────────
    let recentVolume = 0, recentCount = 0
    let priorVolume = 0, priorCount = 0

    for (const o of orders) {
      const oDate = new Date(o.orderDate)
      const amount = Number(o.totalAmount)
      if (oDate >= d60ago) {
        recentVolume += amount
        recentCount++
      } else if (oDate >= d120ago && oDate < d60ago) {
        priorVolume += amount
        priorCount++
      }
    }

    // Volume change %
    const volumeChangePercent = priorVolume > 0
      ? Math.round(((recentVolume - priorVolume) / priorVolume) * 100)
      : recentVolume > 0 ? 100 : 0

    // ── Engagement signals ──────────────────────────────────────────────
    const daysSinceLastContact = c.lastContactDate
      ? Math.floor((today.getTime() - new Date(c.lastContactDate).getTime()) / 86400_000)
      : null

    const hasOverdueFollowUp = c.nextFollowUpDate
      ? new Date(c.nextFollowUpDate) < today
      : false

    // ── Composite risk score (0–100) ───────────────────────────────────
    let score = 0
    const factors: string[] = []

    // Factor 1: Days since last order (0–35 pts)
    if (daysSinceLastOrder >= 60) {
      score += 35; factors.push('超過 60 天未下單')
    } else if (daysSinceLastOrder >= 45) {
      score += 25; factors.push('超過 45 天未下單')
    } else if (daysSinceLastOrder >= 30) {
      score += 15; factors.push('超過 30 天未下單')
    }

    // Factor 2: Volume decline (0–30 pts)
    if (priorVolume > 0) {
      if (volumeChangePercent <= -70) {
        score += 30; factors.push(`使用量大幅下降 ${volumeChangePercent}%`)
      } else if (volumeChangePercent <= -50) {
        score += 22; factors.push(`使用量明顯下降 ${volumeChangePercent}%`)
      } else if (volumeChangePercent <= -30) {
        score += 14; factors.push(`使用量下降 ${volumeChangePercent}%`)
      }
    }

    // Factor 3: Order frequency decline (0–15 pts)
    if (priorCount > 0 && recentCount === 0) {
      score += 15; factors.push('近 60 天零訂單（前期有訂單）')
    } else if (priorCount > 0 && recentCount < priorCount * 0.5) {
      score += 8; factors.push('訂單頻率下降超過 50%')
    }

    // Factor 4: Engagement drop (0–15 pts)
    if (daysSinceLastContact !== null && daysSinceLastContact >= 30) {
      score += 10; factors.push(`${daysSinceLastContact} 天未聯繫`)
    } else if (daysSinceLastContact !== null && daysSinceLastContact >= 14) {
      score += 5; factors.push(`${daysSinceLastContact} 天未聯繫`)
    }
    if (hasOverdueFollowUp) {
      score += 5; factors.push('有逾期未追蹤排程')
    }

    // ── Risk level ─────────────────────────────────────────────────────
    const riskLevel: ChurnAlert['riskLevel'] =
      score >= 60 ? 'CRITICAL' :
      score >= 40 ? 'HIGH' :
      score >= 20 ? 'MEDIUM' : 'LOW'

    // Only include customers with some risk (score >= 15)
    if (score >= 15) {
      alerts.push({
        customerId: c.id,
        customerName: c.name,
        customerCode: c.code,
        salesRep: c.salesRep,
        daysSinceLastOrder,
        lastOrderDate: lastOrder.orderDate.toISOString(),
        lastOrderAmount: Number(lastOrder.totalAmount),
        recentVolume,
        priorVolume,
        volumeChangePercent,
        recentOrderCount: recentCount,
        priorOrderCount: priorCount,
        daysSinceLastContact,
        hasOverdueFollowUp,
        churnRiskScore: Math.min(score, 100),
        riskLevel,
        riskFactors: factors,
      })
    }
  }

  // Sort by risk score descending
  alerts.sort((a, b) => b.churnRiskScore - a.churnRiskScore)

  // ── Summary ──────────────────────────────────────────────────────────────
  const summary = {
    total: alerts.length,
    critical: alerts.filter(a => a.riskLevel === 'CRITICAL').length,
    high:     alerts.filter(a => a.riskLevel === 'HIGH').length,
    medium:   alerts.filter(a => a.riskLevel === 'MEDIUM').length,
    low:      alerts.filter(a => a.riskLevel === 'LOW').length,
    // Aggregate insights
    avgDaysSinceOrder: alerts.length > 0
      ? Math.round(alerts.reduce((s, a) => s + (a.daysSinceLastOrder ?? 0), 0) / alerts.length)
      : 0,
    totalAtRiskRevenue: alerts.reduce((s, a) => s + a.priorVolume, 0),
  }

  return NextResponse.json({ alerts, summary, generatedAt: now.toISOString() })
  } catch (error) {
    return handleApiError(error, 'churnAlerts.get')
  }
}

// ── POST /api/crm/churn-alerts ─────────────────────────────────────────────
// Auto-create follow-up tasks for high-risk customers

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerIds, action } = body as { customerIds: string[]; action: 'CREATE_TASK' | 'MARK_FOLLOWUP' }

  if (!customerIds?.length) {
    return NextResponse.json({ error: 'customerIds required' }, { status: 400 })
  }

  if (action === 'CREATE_TASK') {
    // Bulk-create sales tasks for at-risk customers
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, salesRepId: true },
    })

    const tasks = await Promise.all(
      customers.map(c =>
        prisma.salesTask.create({
          data: {
            title: `流失預警追蹤：${c.name}`,
            description: '系統偵測到該客戶有流失風險，請儘速聯繫了解狀況。',
            taskType: 'FOLLOW_UP',
            priority: 'HIGH',
            status: 'PENDING',
            customerId: c.id,
            assignedToId: c.salesRepId ?? session.user!.id,
            createdById: session.user!.id,
            dueDate: new Date(Date.now() + 3 * 86400_000), // 3 days from now
          },
        })
      )
    )

    return NextResponse.json({ created: tasks.length })
  }

  if (action === 'MARK_FOLLOWUP') {
    // Batch-update customers to flag follow-up
    await prisma.customer.updateMany({
      where: { id: { in: customerIds } },
      data: {
        isFollowUp: true,
        nextFollowUpDate: new Date(Date.now() + 3 * 86400_000),
      },
    })
    return NextResponse.json({ updated: customerIds.length })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'churnAlerts.post')
  }
}
