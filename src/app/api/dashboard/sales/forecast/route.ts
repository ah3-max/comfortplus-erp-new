import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/dashboard/sales/forecast
 * Simple linear regression revenue forecast for next 3 months
 * Uses last 6 months of confirmed order data
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    // Build 6-month monthly buckets
    const months: { label: string; start: Date; end: Date }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const label = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, '0')}`
      months.push({ label, start, end })
    }

    // Fetch monthly revenue
    const monthlyData = await Promise.all(
      months.map(m =>
        prisma.salesOrder.aggregate({
          where: {
            createdAt: { gte: m.start, lte: m.end },
            status: { notIn: ['CANCELLED', 'DRAFT'] },
          },
          _sum: { totalAmount: true },
        }).then(r => ({ label: m.label, revenue: Number(r._sum.totalAmount ?? 0) }))
      )
    )

    // Linear regression on index vs revenue
    const n = monthlyData.length
    const xs = monthlyData.map((_, i) => i)
    const ys = monthlyData.map(d => d.revenue)
    const sumX  = xs.reduce((a, b) => a + b, 0)
    const sumY  = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
    const sumX2 = xs.reduce((s, x) => s + x * x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Forecast next 3 months
    const forecast: { label: string; revenue: number; isForecast: true }[] = []
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = `${futureDate.getFullYear()}/${String(futureDate.getMonth() + 1).padStart(2, '0')}`
      const revenue = Math.max(0, Math.round(intercept + slope * (n - 1 + i)))
      forecast.push({ label, revenue, isForecast: true })
    }

    // Confidence: based on R²
    const yMean = sumY / n
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0)
    const ssRes = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2, 0)
    const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)
    const confidence = Math.round(r2 * 100)

    // Trend
    const recentAvg = ys.slice(-3).reduce((a, b) => a + b, 0) / 3
    const earlierAvg = ys.slice(0, 3).reduce((a, b) => a + b, 0) / 3
    const trend = earlierAvg === 0 ? null : Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100)

    return NextResponse.json({
      history: monthlyData,
      forecast,
      confidence,
      trend,
      slope: Math.round(slope),
    })
  } catch (error) {
    return handleApiError(error, 'dashboard.sales.forecast')
  }
}
