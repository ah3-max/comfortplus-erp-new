import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// 現金出納帳：查 PaymentRecord 逐筆，計算累計餘額
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const method = searchParams.get('method') || undefined // 付款方式篩選

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    // Opening balance: sum all payments before periodStart
    const [openIncoming, openOutgoing] = await Promise.all([
      prisma.paymentRecord.aggregate({
        where: { direction: 'INCOMING', paymentDate: { lt: periodStart } },
        _sum: { amount: true },
      }),
      prisma.paymentRecord.aggregate({
        where: { direction: 'OUTGOING', paymentDate: { lt: periodStart } },
        _sum: { amount: true },
      }),
    ])
    const openingBalance = Number(openIncoming._sum.amount ?? 0) - Number(openOutgoing._sum.amount ?? 0)

    // Period payments
    const payments = await prisma.paymentRecord.findMany({
      where: {
        paymentDate: { gte: periodStart, lte: periodEnd },
        ...(method && { paymentMethod: method }),
      },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    })

    let runningBalance = openingBalance
    const rows = payments.map(p => {
      const amount = Number(p.amount)
      const isIncoming = p.direction === 'INCOMING'
      if (isIncoming) runningBalance += amount
      else runningBalance -= amount

      const partyName = p.customer?.name ?? p.supplier?.name ?? '—'

      return {
        id: p.id,
        paymentNo: p.paymentNo,
        date: p.paymentDate.toISOString().slice(0, 10),
        description: `${p.paymentType} ${p.notes ?? ''}`.trim(),
        partyName,
        paymentMethod: p.paymentMethod ?? '—',
        referenceNo: p.referenceNo ?? '',
        incoming: isIncoming ? Math.round(amount * 100) / 100 : 0,
        outgoing: !isIncoming ? Math.round(amount * 100) / 100 : 0,
        balance: Math.round(runningBalance * 100) / 100,
      }
    })

    const periodIncoming = payments.filter(p => p.direction === 'INCOMING').reduce((s, p) => s + Number(p.amount), 0)
    const periodOutgoing = payments.filter(p => p.direction === 'OUTGOING').reduce((s, p) => s + Number(p.amount), 0)

    return NextResponse.json({
      openingBalance: Math.round(openingBalance * 100) / 100,
      periodIncoming: Math.round(periodIncoming * 100) / 100,
      periodOutgoing: Math.round(periodOutgoing * 100) / 100,
      closingBalance: Math.round(runningBalance * 100) / 100,
      rows,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
    })
  } catch (error) {
    return handleApiError(error, 'finance.cash-book.GET')
  }
}
