import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'PROCUREMENT']

/**
 * GET /api/finance/accounts-payable
 *
 * 應付帳款列表 — 支援搜尋/篩選/分頁/摘要
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const supplierId = searchParams.get('supplierId') ?? ''
    const dateFrom = searchParams.get('dateFrom') ?? ''
    const dateTo = searchParams.get('dateTo') ?? ''
    const overdue = searchParams.get('overdue')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { supplier: { code: { contains: search, mode: 'insensitive' } } },
        { purchaseOrder: { poNo: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (overdue === 'true') {
      where.status = { in: ['DUE', 'PARTIAL_PAID'] }
      where.dueDate = { lt: new Date() }
    }
    if (dateFrom || dateTo) {
      where.invoiceDate = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
      }
    }

    const [data, total, summary] = await Promise.all([
      prisma.accountsPayable.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          purchaseOrder: { select: { id: true, poNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.accountsPayable.count({ where }),
      prisma.accountsPayable.aggregate({
        where: { status: { notIn: ['PAID'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
    ])

    const now = new Date()
    const overdueAgg = await prisma.accountsPayable.aggregate({
      where: { status: { notIn: ['PAID'] }, dueDate: { lt: now } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    })

    const totalOutstanding = Number(summary._sum.amount ?? 0) - Number(summary._sum.paidAmount ?? 0)
    const totalOverdue = Number(overdueAgg._sum.amount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0)

    const mapped = data.map(r => ({
      id: r.id,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate,
      dueDate: r.dueDate,
      amount: Number(r.amount),
      paidAmount: Number(r.paidAmount),
      balance: Number(r.amount) - Number(r.paidAmount),
      status: r.status,
      currency: r.currency,
      apCategory: r.apCategory,
      notes: r.notes,
      supplier: r.supplier,
      purchaseOrder: r.purchaseOrder,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: {
        totalOutstanding: Math.round(totalOutstanding),
        totalOverdue: Math.round(totalOverdue),
        overdueCount: overdueAgg._count,
        unpaidCount: summary._count,
      },
    })
  } catch (error) {
    return handleApiError(error, 'accounts-payable.GET')
  }
}
