import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/customers/[id]/credit
 * Detailed credit profile: limit, outstanding AR breakdown, recent payments
 *
 * PUT /api/customers/[id]/credit
 * Update creditLimit (FINANCE / SUPER_ADMIN / GM only)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER', 'CS', 'SALES'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        creditLimit: true,
        paymentTerms: true,
        riskLevel: true,
        isMonthly: true,
        accountsReceivable: {
          where: { status: { notIn: ['PAID'] } },
          select: {
            id: true,
            invoiceNo: true,
            invoiceDate: true,
            dueDate: true,
            amount: true,
            paidAmount: true,
            agingDays: true,
            status: true,
            order: { select: { orderNo: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!customer) return NextResponse.json({ error: '客戶不存在' }, { status: 404 })

    const now = new Date()
    const limit = customer.creditLimit ? Number(customer.creditLimit) : null
    const outstanding = customer.accountsReceivable.reduce(
      (s, ar) => s + Math.max(0, Number(ar.amount) - Number(ar.paidAmount)), 0
    )
    const overdue = customer.accountsReceivable
      .filter(ar => ar.dueDate && new Date(ar.dueDate) < now)
      .reduce((s, ar) => s + Math.max(0, Number(ar.amount) - Number(ar.paidAmount)), 0)

    // Aging buckets
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
    for (const ar of customer.accountsReceivable) {
      const bal = Math.max(0, Number(ar.amount) - Number(ar.paidAmount))
      if (!ar.dueDate || new Date(ar.dueDate) >= now) {
        aging.current += bal
      } else {
        const days = Math.floor((now.getTime() - new Date(ar.dueDate).getTime()) / 86400000)
        if (days <= 30) aging.days30 += bal
        else if (days <= 60) aging.days60 += bal
        else if (days <= 90) aging.days90 += bal
        else aging.over90 += bal
      }
    }

    // Recent payment records (last 6)
    const recentPayments = await prisma.paymentRecord.findMany({
      where: { customerId: id, direction: 'INCOMING' },
      select: { amount: true, paymentDate: true, paymentMethod: true, referenceNo: true },
      orderBy: { paymentDate: 'desc' },
      take: 6,
    })

    const utilizationPct = limit && limit > 0 ? (outstanding / limit) * 100 : null
    let creditStatus: 'NO_LIMIT' | 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED' = 'NO_LIMIT'
    if (limit !== null) {
      if (outstanding > limit) creditStatus = 'EXCEEDED'
      else if (utilizationPct! >= 90) creditStatus = 'CRITICAL'
      else if (utilizationPct! >= 70) creditStatus = 'WARNING'
      else creditStatus = 'NORMAL'
    }

    return NextResponse.json({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      creditLimit: limit,
      creditUsed: outstanding,
      creditAvailable: limit !== null ? Math.max(0, limit - outstanding) : null,
      utilizationPct: utilizationPct !== null ? Math.round(utilizationPct * 10) / 10 : null,
      overdueAmount: overdue,
      creditStatus,
      paymentTerms: customer.paymentTerms,
      riskLevel: customer.riskLevel,
      isMonthly: customer.isMonthly,
      aging,
      arItems: customer.accountsReceivable.map(ar => ({
        ...ar,
        balance: Math.max(0, Number(ar.amount) - Number(ar.paidAmount)),
        overdueDays: ar.dueDate && new Date(ar.dueDate) < now
          ? Math.floor((now.getTime() - new Date(ar.dueDate).getTime()) / 86400000)
          : 0,
      })),
      recentPayments,
    })
  } catch (error) {
    return handleApiError(error, 'customers.credit.GET')
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '只有財務/GM/管理員可調整信用額度' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { creditLimit } = body

    if (creditLimit !== null && creditLimit !== undefined && (isNaN(Number(creditLimit)) || Number(creditLimit) < 0)) {
      return NextResponse.json({ error: '信用額度必須為正數或 0' }, { status: 400 })
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { creditLimit: creditLimit !== null && creditLimit !== undefined ? creditLimit : null },
      select: { id: true, name: true, creditLimit: true },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'customers',
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: id,
      entityLabel: customer.name,
    }).catch(() => {})

    return NextResponse.json(customer)
  } catch (error) {
    return handleApiError(error, 'customers.credit.PUT')
  }
}
