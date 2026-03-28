import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/suppliers/performance
 * Supplier KPI: delivery punctuality, order value, QC pass rate
 * Query: startDate, endDate, supplierId (optional)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT', 'SALES_MANAGER', 'WAREHOUSE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')
    const supplierId = searchParams.get('supplierId') ?? undefined

    const now = new Date()
    const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), 0, 1)
    const end = endStr ? new Date(endStr) : now
    end.setHours(23, 59, 59, 999)

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        purchaseDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'CANCELLED'] as ('DRAFT' | 'CANCELLED')[] },
        ...(supplierId ? { supplierId } : {}),
      },
      select: {
        id: true,
        supplierId: true,
        totalAmount: true,
        expectedDate: true,
        status: true,
        defectRate: true,
        supplier: { select: { id: true, name: true, country: true } },
        receipts: {
          select: { receiptDate: true },
          orderBy: { receiptDate: 'desc' },
          take: 1,
        },
      },
    })

    // Aggregate by supplier
    type SupplierKPI = {
      supplierId: string
      name: string
      country: string | null
      orderCount: number
      totalAmount: number
      onTimeCount: number     // delivered <= expectedDate
      lateCount: number
      noReceiptCount: number  // ordered but not yet received
      avgLeadDays: number | null
      leadDaysSum: number
      leadDaysCount: number
      defectRates: number[]
    }

    const bySupplier = new Map<string, SupplierKPI>()

    for (const o of orders) {
      const kpi = bySupplier.get(o.supplierId) ?? {
        supplierId: o.supplierId,
        name: o.supplier.name,
        country: o.supplier.country ?? null,
        orderCount: 0,
        totalAmount: 0,
        onTimeCount: 0,
        lateCount: 0,
        noReceiptCount: 0,
        avgLeadDays: null,
        leadDaysSum: 0,
        leadDaysCount: 0,
        defectRates: [],
      }

      kpi.orderCount++
      kpi.totalAmount += Number(o.totalAmount)

      const latestReceipt = o.receipts[0]
      if (latestReceipt) {
        const receiptDate = new Date(latestReceipt.receiptDate)
        if (o.expectedDate) {
          const lead = Math.floor((receiptDate.getTime() - new Date(o.expectedDate).getTime()) / 86400000)
          if (lead <= 0) kpi.onTimeCount++
          else kpi.lateCount++
        }
        // Lead time from purchase to receipt
        kpi.leadDaysSum += Math.max(0, Math.floor((receiptDate.getTime() - now.getTime()) / 86400000))
        kpi.leadDaysCount++
      } else if (['ORDERED', 'FACTORY_CONFIRMED', 'IN_PRODUCTION', 'PARTIAL'].includes(o.status)) {
        kpi.noReceiptCount++
      }

      if (o.defectRate !== null) kpi.defectRates.push(Number(o.defectRate))

      bySupplier.set(o.supplierId, kpi)
    }

    const data = [...bySupplier.values()].map(kpi => {
      const received = kpi.onTimeCount + kpi.lateCount
      const onTimePct = received > 0 ? Math.round(kpi.onTimeCount / received * 1000) / 10 : null
      const avgDefectRate = kpi.defectRates.length > 0
        ? Math.round(kpi.defectRates.reduce((s, v) => s + v, 0) / kpi.defectRates.length * 100) / 100
        : null

      // Score: 0-100. Weighted: onTime 60%, defect 40%
      let score: number | null = null
      if (onTimePct !== null) {
        score = Math.round(onTimePct * 0.6 + (avgDefectRate !== null ? Math.max(0, 100 - avgDefectRate * 10) * 0.4 : 0))
      }

      return {
        supplierId: kpi.supplierId,
        name: kpi.name,
        country: kpi.country,
        orderCount: kpi.orderCount,
        totalAmount: kpi.totalAmount,
        onTimeCount: kpi.onTimeCount,
        lateCount: kpi.lateCount,
        noReceiptCount: kpi.noReceiptCount,
        onTimePct,
        avgDefectRate,
        score,
        grade: score === null ? null : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
      }
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

    const summary = {
      totalSuppliers: data.length,
      totalOrders: data.reduce((s, v) => s + v.orderCount, 0),
      totalAmount: data.reduce((s, v) => s + v.totalAmount, 0),
      gradeA: data.filter(d => d.grade === 'A').length,
      gradeB: data.filter(d => d.grade === 'B').length,
      gradeC: data.filter(d => d.grade === 'C').length,
      gradeD: data.filter(d => d.grade === 'D').length,
    }

    return NextResponse.json({ data, summary })
  } catch (error) {
    return handleApiError(error, 'suppliers.performance.GET')
  }
}
