import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/statements
 * List reconciliation statements. Filters: customerId, status, year, month
 *
 * POST /api/statements
 * Generate a statement for a customer + period.
 * Body: { customerId, periodStart, periodEnd, notes? }
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'CS', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '30'))

    const where = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    }

    const [total, data] = await Promise.all([
      prisma.reconciliationStatement.count({ where }),
      prisma.reconciliationStatement.findMany({
        where,
        select: {
          id: true, statementNo: true, periodStart: true, periodEnd: true,
          openingBalance: true, totalBilled: true, totalReceived: true,
          totalAdjustment: true, closingBalance: true,
          status: true, customerConfirmedAt: true, createdAt: true,
          customer: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'statements.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'CS'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { customerId, periodStart, periodEnd, notes } = body

    if (!customerId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: '必填：customerId, periodStart, periodEnd' }, { status: 400 })
    }

    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    end.setHours(23, 59, 59, 999)

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    })
    if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 404 })

    // Opening balance: outstanding AR before period start
    const priorAR = await prisma.accountsReceivable.findMany({
      where: {
        customerId,
        invoiceDate: { lt: start },
        status: { notIn: ['PAID'] },
      },
      select: { amount: true, paidAmount: true },
    })
    const openingBalance = priorAR.reduce(
      (s, ar) => s + Math.max(0, Number(ar.amount) - Number(ar.paidAmount)), 0
    )

    // Billed in period: from SalesOrders
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        customerId,
        status: { notIn: ['CANCELLED', 'DRAFT'] },
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true, orderNo: true, totalAmount: true, paidAmount: true,
        createdAt: true, status: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    const totalBilled = salesOrders.reduce((s, o) => s + Number(o.totalAmount), 0)

    // Payments received in period
    const payments = await prisma.paymentRecord.findMany({
      where: {
        customerId,
        direction: 'INCOMING',
        paymentDate: { gte: start, lte: end },
      },
      select: {
        id: true, amount: true, paymentDate: true,
        paymentMethod: true, referenceNo: true, notes: true,
      },
      orderBy: { paymentDate: 'asc' },
    })
    const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0)

    const closingBalance = openingBalance + totalBilled - totalReceived

    // Build line items JSON
    const lineItems = [
      // Opening
      { type: 'OPENING', date: start.toISOString().slice(0, 10), description: '期初餘額', debit: openingBalance, credit: 0, balance: openingBalance },
      // Sales orders
      ...salesOrders.map(o => ({
        type: 'INVOICE',
        date: new Date(o.createdAt).toISOString().slice(0, 10),
        description: `銷貨單 ${o.orderNo}`,
        refId: o.id,
        debit: Number(o.totalAmount),
        credit: 0,
        balance: 0, // Filled by running balance below
      })),
      // Payments
      ...payments.map(p => ({
        type: 'PAYMENT',
        date: new Date(p.paymentDate).toISOString().slice(0, 10),
        description: `收款${p.paymentMethod ? ` (${p.paymentMethod})` : ''}${p.referenceNo ? ` #${p.referenceNo}` : ''}`,
        refId: p.id,
        debit: 0,
        credit: Number(p.amount),
        balance: 0,
      })),
    ]
    // Sort by date and compute running balance
    lineItems.sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'OPENING' ? -1 : 1))
    let running = 0
    for (const item of lineItems) {
      running += item.debit - item.credit
      item.balance = running
    }

    const statementNo = await generateSequenceNo('STATEMENT')

    const statement = await prisma.reconciliationStatement.create({
      data: {
        statementNo,
        customerId,
        periodStart: start,
        periodEnd: end,
        openingBalance,
        totalBilled,
        totalReceived,
        totalAdjustment: 0,
        closingBalance,
        lineItems,
        status: 'DRAFT',
        notes,
        createdById: session.user.id,
      },
      select: {
        id: true, statementNo: true, status: true,
        openingBalance: true, totalBilled: true, totalReceived: true, closingBalance: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'statements',
      action: 'CREATE',
      entityType: 'ReconciliationStatement',
      entityId: statement.id,
      entityLabel: statement.statementNo,
    }).catch(() => {})

    return NextResponse.json(statement, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'statements.POST')
  }
}
