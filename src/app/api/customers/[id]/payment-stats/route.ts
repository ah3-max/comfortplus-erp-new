import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/customers/[id]/payment-stats
 * Returns average payment days and payment history stats for a customer
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Get payment records (INCOMING = 收款)
    const payments = await prisma.paymentRecord.findMany({
      where: {
        customerId: id,
        direction: 'INCOMING',
      },
      orderBy: { paymentDate: 'desc' },
      take: 50,
      select: {
        id: true, paymentNo: true, amount: true,
        paymentDate: true, paymentMethod: true, salesOrderId: true,
      },
    })

    if (payments.length === 0) {
      return NextResponse.json({ avgPaymentDays: null, totalPayments: 0, recentPayments: [] })
    }

    // Fetch related orders to compute payment days
    const orderIds = payments.map(p => p.salesOrderId).filter(Boolean) as string[]
    const orders = await prisma.salesOrder.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNo: true, createdAt: true },
    })
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]))

    // Calculate days from order creation to payment
    const daysArray: number[] = []
    for (const p of payments) {
      const order = p.salesOrderId ? orderMap[p.salesOrderId] : null
      if (order?.createdAt) {
        const days = Math.floor(
          (new Date(p.paymentDate).getTime() - new Date(order.createdAt).getTime()) / 86400000
        )
        if (days >= 0) daysArray.push(days)
      }
    }

    const avgPaymentDays = daysArray.length > 0
      ? Math.round(daysArray.reduce((s, d) => s + d, 0) / daysArray.length)
      : null

    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0)

    const recentPayments = payments.slice(0, 10).map(p => ({
      id: p.id,
      paymentNo: p.paymentNo,
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      orderNo: p.salesOrderId ? orderMap[p.salesOrderId]?.orderNo ?? null : null,
    }))

    return NextResponse.json({
      avgPaymentDays,
      totalPayments: payments.length,
      totalAmount,
      recentPayments,
    })
  } catch (error) {
    return handleApiError(error, 'customers.paymentStats')
  }
}
