import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const supplierId = searchParams.get('supplierId')
    const bankAccount = searchParams.get('bankAccount')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      direction: 'OUTGOING',
      paymentDate: { gte: periodStart, lte: periodEnd },
    }
    if (supplierId) where.supplierId = supplierId
    if (bankAccount) where.bankAccount = { contains: bankAccount, mode: 'insensitive' }

    const records = await prisma.paymentRecord.findMany({ where, orderBy: { paymentDate: 'asc' } })

    // Fetch supplier names for records that have a supplierId
    const supplierIds = [...new Set(records.map(r => r.supplierId).filter((id): id is string => id != null))]
    const suppliers = supplierIds.length > 0
      ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, code: true } })
      : []
    const supplierMap = new Map(suppliers.map(s => [s.id, s]))

    const rows = records.map(r => {
      const sup = r.supplierId ? supplierMap.get(r.supplierId) : undefined
      return {
        id: r.id,
        paymentNo: r.paymentNo ?? '',
        paymentDate: r.paymentDate?.toISOString().slice(0, 10) ?? r.createdAt.toISOString().slice(0, 10),
        supplierId: r.supplierId ?? '',
        supplierName: sup?.name ?? '—',
        supplierCode: sup?.code ?? '',
        bankAccount: r.bankAccount ?? '',
        paymentMethod: r.paymentMethod ?? '',
        amount: Number(r.amount),
        invoiceNo: r.invoiceNo ?? '',
        referenceNo: r.referenceNo ?? '',
        notes: r.notes ?? '',
      }
    })

    const byBank: Record<string, { bankAccount: string; count: number; totalAmount: number }> = {}
    for (const r of rows) {
      const key = r.bankAccount || '未指定'
      if (!byBank[key]) byBank[key] = { bankAccount: key, count: 0, totalAmount: 0 }
      byBank[key].count++
      byBank[key].totalAmount += r.amount
    }

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        count: rows.length,
        totalAmount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        byBank: Object.values(byBank),
      },
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.payment-transfer-list.GET')
  }
}
