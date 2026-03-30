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
    const partyType = searchParams.get('partyType') // CUSTOMER or SUPPLIER
    const partyId = searchParams.get('partyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!partyType || !partyId) {
      return NextResponse.json({ error: '請指定往來對象類型與 ID' }, { status: 400 })
    }

    const periodStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const periodEnd = endDate ? new Date(endDate) : new Date()
    periodEnd.setHours(23, 59, 59, 999)

    interface TxRow {
      id: string; date: string; type: string
      referenceNo: string; description: string; debit: number; credit: number
    }
    const txRows: TxRow[] = []
    let party: { id: string; name: string; code: string; type: string } | null = null

    if (partyType === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { id: partyId },
        select: { id: true, name: true, code: true },
      })
      if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 404 })
      party = { ...customer, code: customer.code ?? '', type: 'CUSTOMER' }

      // AR records
      const arRecords = await prisma.accountsReceivable.findMany({
        where: { customerId: partyId, createdAt: { gte: periodStart, lte: periodEnd } },
        orderBy: { createdAt: 'asc' },
      })
      for (const r of arRecords) {
        txRows.push({
          id: `ar-${r.id}`,
          date: (r.invoiceDate ?? r.createdAt).toISOString().slice(0, 10),
          type: 'AR',
          referenceNo: r.invoiceNo ?? '',
          description: `應收帳款`,
          debit: Number(r.amount),
          credit: 0,
        })
      }

      // Payment records
      const payments = await prisma.paymentRecord.findMany({
        where: { customerId: partyId, paymentDate: { gte: periodStart, lte: periodEnd } },
        orderBy: { paymentDate: 'asc' },
      })
      for (const p of payments) {
        txRows.push({
          id: `pay-${p.id}`,
          date: p.paymentDate.toISOString().slice(0, 10),
          type: 'PAYMENT_IN',
          referenceNo: p.paymentNo,
          description: `收款 - ${p.paymentMethod ?? ''}`,
          debit: 0,
          credit: Number(p.amount),
        })
      }
    } else {
      const supplier = await prisma.supplier.findUnique({
        where: { id: partyId },
        select: { id: true, name: true, code: true },
      })
      if (!supplier) return NextResponse.json({ error: '供應商不存在' }, { status: 404 })
      party = { ...supplier, code: supplier.code ?? '', type: 'SUPPLIER' }

      // AP records
      const apRecords = await prisma.accountsPayable.findMany({
        where: { supplierId: partyId, createdAt: { gte: periodStart, lte: periodEnd } },
        orderBy: { createdAt: 'asc' },
      })
      for (const r of apRecords) {
        txRows.push({
          id: `ap-${r.id}`,
          date: (r.invoiceDate ?? r.createdAt).toISOString().slice(0, 10),
          type: 'AP',
          referenceNo: r.invoiceNo ?? '',
          description: `應付帳款`,
          debit: 0,
          credit: Number(r.amount),
        })
      }

      // Payment records
      const payments = await prisma.paymentRecord.findMany({
        where: { supplierId: partyId, paymentDate: { gte: periodStart, lte: periodEnd } },
        orderBy: { paymentDate: 'asc' },
      })
      for (const p of payments) {
        txRows.push({
          id: `pay-${p.id}`,
          date: p.paymentDate.toISOString().slice(0, 10),
          type: 'PAYMENT_OUT',
          referenceNo: p.paymentNo,
          description: `付款 - ${p.paymentMethod ?? ''}`,
          debit: Number(p.amount),
          credit: 0,
        })
      }
    }

    // Sort by date, compute running balance
    txRows.sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    const rows = txRows.map(r => {
      running += r.debit - r.credit
      return { ...r, balance: Math.round(running * 100) / 100 }
    })

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

    return NextResponse.json({
      party,
      period: { startDate: periodStart.toISOString().slice(0, 10), endDate: periodEnd.toISOString().slice(0, 10) },
      summary: {
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        netBalance: Math.round((totalDebit - totalCredit) * 100) / 100,
      },
      rows,
    })
  } catch (error) {
    return handleApiError(error, 'finance.party-transactions.GET')
  }
}
