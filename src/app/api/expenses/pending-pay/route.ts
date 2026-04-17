import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const CASHIER_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * GET /api/expenses/pending-pay
 * 出納待付清單：狀態 APPROVED 的費用請款單
 * Query: page, pageSize
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!CASHIER_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'))

    const where = { status: 'APPROVED' }

    const [data, total] = await Promise.all([
      prisma.expenseReport.findMany({
        where,
        include: {
          submittedBy: {
            select: {
              id: true, name: true,
              bankAccountNo: true, bankCode: true, bankAccountName: true,
            },
          },
          approvedBy: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { approvedAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseReport.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'expenses.pending-pay')
  }
}
