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
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      createdAt: { gte: periodStart, lte: periodEnd },
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const records = await prisma.accountsPayable.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchaseOrder: { select: { poNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows = records.map(r => ({
      id: r.id,
      invoiceNo: r.invoiceNo ?? '',
      invoiceDate: r.invoiceDate?.toISOString().slice(0, 10) ?? r.createdAt.toISOString().slice(0, 10),
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? null,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      supplierCode: r.supplier.code ?? '',
      poNo: r.purchaseOrder?.poNo ?? '',
      amount: Number(r.amount),
      paidAmount: Number(r.paidAmount),
      balance: Number(r.amount) - Number(r.paidAmount),
      status: r.status,
      currency: r.currency,
    }))

    const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
    const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0)
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0)

    return NextResponse.json({
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        count: rows.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100,
      },
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.ap-voucher-detail.GET')
  }
}
