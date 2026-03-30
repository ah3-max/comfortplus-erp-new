import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId') || undefined
    const currency = searchParams.get('currency') || undefined

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const aps = await prisma.accountsPayable.findMany({
      where: {
        status: { in: ['NOT_DUE', 'DUE', 'PARTIAL_PAID'] },
        ...(supplierId && { supplierId }),
        ...(currency && { currency }),
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Group by supplier
    const supplierMap = new Map<string, {
      supplierId: string
      supplierName: string
      supplierCode: string | null
      current: number    // not yet due
      days1_30: number   // 1-30 days overdue
      days31_60: number  // 31-60 days overdue
      days61_90: number  // 61-90 days overdue
      days90plus: number // 90+ days overdue
      total: number
      count: number
      items: Array<{
        id: string
        invoiceNo: string | null
        dueDate: string | null
        amount: number
        paidAmount: number
        outstanding: number
        daysOverdue: number
        status: string
        currency: string
      }>
    }>()

    for (const ap of aps) {
      const outstanding = Number(ap.amount) - Number(ap.paidAmount)
      if (outstanding <= 0) continue

      let daysOverdue = 0
      if (ap.dueDate) {
        const due = new Date(ap.dueDate)
        due.setHours(0, 0, 0, 0)
        daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      }

      const key = ap.supplierId
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplierId: ap.supplier.id,
          supplierName: ap.supplier.name,
          supplierCode: ap.supplier.code ?? null,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90plus: 0,
          total: 0,
          count: 0,
          items: [],
        })
      }

      const entry = supplierMap.get(key)!
      entry.total += outstanding
      entry.count += 1

      if (daysOverdue <= 0) {
        entry.current += outstanding
      } else if (daysOverdue <= 30) {
        entry.days1_30 += outstanding
      } else if (daysOverdue <= 60) {
        entry.days31_60 += outstanding
      } else if (daysOverdue <= 90) {
        entry.days61_90 += outstanding
      } else {
        entry.days90plus += outstanding
      }

      entry.items.push({
        id: ap.id,
        invoiceNo: ap.invoiceNo ?? null,
        dueDate: ap.dueDate?.toISOString() ?? null,
        amount: Number(ap.amount),
        paidAmount: Number(ap.paidAmount),
        outstanding,
        daysOverdue,
        status: ap.status,
        currency: ap.currency,
      })
    }

    const rows = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total)

    // Summary totals
    const summary = {
      current: rows.reduce((s, r) => s + r.current, 0),
      days1_30: rows.reduce((s, r) => s + r.days1_30, 0),
      days31_60: rows.reduce((s, r) => s + r.days31_60, 0),
      days61_90: rows.reduce((s, r) => s + r.days61_90, 0),
      days90plus: rows.reduce((s, r) => s + r.days90plus, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
      supplierCount: rows.length,
      invoiceCount: rows.reduce((s, r) => s + r.count, 0),
    }

    return NextResponse.json({ rows, summary, asOf: today.toISOString() })
  } catch (error) {
    return handleApiError(error, 'finance.ap-aging.GET')
  }
}
