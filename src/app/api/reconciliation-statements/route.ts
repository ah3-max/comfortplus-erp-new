import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER']

// ── GET /api/reconciliation-statements ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const status     = searchParams.get('status')
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize   = Math.min(100, Number(searchParams.get('pageSize') ?? 20))

    const where = {
      ...(customerId && { customerId }),
      ...(status && { status }),
    }

    const [data, total] = await Promise.all([
      prisma.reconciliationStatement.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reconciliationStatement.count({ where }),
    ])

    return NextResponse.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    return handleApiError(error, 'reconciliation-statements.GET')
  }
}

// ── POST /api/reconciliation-statements ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { customerId, periodStart, periodEnd, notes } = body

    if (!customerId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: '客戶、起迄日期為必填' }, { status: 400 })
    }

    const ps = new Date(periodStart)
    const pe = new Date(periodEnd)

    // 計算期間內的帳款活動
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } })
    if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 404 })

    // 期初餘額 = 期間前的未結 AR 餘額
    const arBefore = await prisma.accountsReceivable.findMany({
      where: { customerId, createdAt: { lt: ps } },
    })
    const openingBalance = arBefore.reduce((s, r) => s + (Number(r.amount) - Number(r.paidAmount)), 0)

    // 本期新增帳款
    const arInPeriod = await prisma.accountsReceivable.findMany({
      where: { customerId, createdAt: { gte: ps, lte: pe } },
    })
    const totalBilled = arInPeriod.reduce((s, r) => s + Number(r.amount), 0)

    // 本期收款
    const receipts = await prisma.receiptRecord.findMany({
      where: { customerId, receiptDate: { gte: ps, lte: pe } },
    })
    const totalReceived = receipts.reduce((s, r) => s + Number(r.amount), 0)

    const closingBalance = openingBalance + totalBilled - totalReceived

    const statementNo = await generateSequenceNo('STATEMENT')

    const record = await prisma.reconciliationStatement.create({
      data: {
        statementNo,
        customerId,
        periodStart: ps,
        periodEnd: pe,
        openingBalance,
        totalBilled,
        totalReceived,
        totalAdjustment: 0,
        closingBalance,
        lineItems: {
          arItems: arInPeriod.map(a => ({ invoiceNo: a.invoiceNo, amount: Number(a.amount), date: a.createdAt })),
          receiptItems: receipts.map(r => ({ amount: Number(r.amount), date: r.receiptDate, method: r.receiptMethod })),
        },
        notes: notes ?? null,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'reconciliation-statements', action: 'CREATE',
      entityType: 'ReconciliationStatement', entityId: record.id, entityLabel: statementNo,
    }).catch(() => {})

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'reconciliation-statements.POST')
  }
}
