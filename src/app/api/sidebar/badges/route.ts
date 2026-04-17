import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/sidebar/badges — aggregate counters for sidebar badges
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const role = user?.role ?? ''
    const isFinance = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

    if (!isFinance) return NextResponse.json({})

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [expensesPending, expensesToPay, arOverdue, apToPay, bankUnreconciled] = await Promise.all([
      prisma.expenseReport.count({ where: { status: 'SUBMITTED' } }).catch(() => 0),
      prisma.expenseReport.count({ where: { status: 'APPROVED', paidAt: null } }).catch(() => 0),
      prisma.accountsReceivable.count({
        where: { dueDate: { lt: today }, status: { in: ['DUE', 'PARTIAL_PAID', 'NOT_DUE'] } },
      }).catch(() => 0),
      prisma.accountsPayable.count({
        where: { dueDate: { lte: today }, status: { in: ['DUE', 'PARTIAL_PAID', 'NOT_DUE'] } },
      }).catch(() => 0),
      prisma.receiptRecord.count({ where: { reconcileStatus: 'PENDING' } }).catch(() => 0),
    ])

    return NextResponse.json({
      expensesPending,
      expensesToPay,
      arOverdue,
      apToPay,
      bankUnreconciled,
    })
  } catch (error) {
    return handleApiError(error, 'sidebar.badges')
  }
}
