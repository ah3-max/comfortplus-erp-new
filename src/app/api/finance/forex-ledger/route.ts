import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const CURRENCIES = ['USD', 'EUR', 'JPY', 'CNY', 'THB']

function detectCurrency(bankAccount: string | null, notes: string | null): string {
  const text = `${bankAccount ?? ''} ${notes ?? ''}`.toUpperCase()
  for (const c of CURRENCIES) {
    if (text.includes(c)) return c
  }
  return 'TWD'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const currency = searchParams.get('currency') ?? 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    const currencyList = currency === 'all' ? CURRENCIES : [currency.toUpperCase()]

    const orConditions = currencyList.flatMap(c => [
      { bankAccount: { contains: c, mode: 'insensitive' as const } },
      { notes: { contains: c, mode: 'insensitive' as const } },
    ])

    const records = await prisma.paymentRecord.findMany({
      where: {
        paymentDate: { gte: periodStart, lte: periodEnd },
        OR: orConditions,
      },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { paymentDate: 'asc' },
    })

    const rows = records.map(r => {
      const det = detectCurrency(r.bankAccount, r.notes)
      return {
        id: r.id,
        paymentNo: r.paymentNo,
        paymentDate: r.paymentDate.toISOString().slice(0, 10),
        direction: r.direction,
        amount: Number(r.amount),
        paymentMethod: r.paymentMethod ?? '',
        bankAccount: r.bankAccount ?? '',
        partyName: r.customer?.name ?? r.supplier?.name ?? '—',
        notes: r.notes ?? '',
        detectedCurrency: det,
      }
    })

    const byCurrencyMap: Record<string, { incoming: number; outgoing: number; count: number }> = {}
    for (const row of rows) {
      if (!byCurrencyMap[row.detectedCurrency]) {
        byCurrencyMap[row.detectedCurrency] = { incoming: 0, outgoing: 0, count: 0 }
      }
      const entry = byCurrencyMap[row.detectedCurrency]
      if (row.direction === 'INCOMING') entry.incoming += row.amount
      else entry.outgoing += row.amount
      entry.count++
    }
    const byCurrency = Object.entries(byCurrencyMap).map(([c, v]) => ({ currency: c, ...v }))

    const totalIncoming = rows.filter(r => r.direction === 'INCOMING').reduce((s, r) => s + r.amount, 0)
    const totalOutgoing = rows.filter(r => r.direction === 'OUTGOING').reduce((s, r) => s + r.amount, 0)

    return NextResponse.json({
      currency,
      summary: {
        totalIncoming: Math.round(totalIncoming * 100) / 100,
        totalOutgoing: Math.round(totalOutgoing * 100) / 100,
        netFlow: Math.round((totalIncoming - totalOutgoing) * 100) / 100,
        txCount: rows.length,
      },
      byCurrency,
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.forex-ledger.GET')
  }
}
