import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const APPROVER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'FINANCE']

/**
 * POST /api/expenses/:id/reject
 * 主管退回，狀態 SUBMITTED → REJECTED
 * Body: { reason }（必填）
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!APPROVER_ROLES.includes(role)) {
    return NextResponse.json({ error: '無審核權限' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason: string = body.reason ?? ''
    if (!reason.trim()) {
      return NextResponse.json({ error: '請填寫退回原因' }, { status: 400 })
    }

    const report = await prisma.expenseReport.findUnique({ where: { id } })
    if (!report) return NextResponse.json({ error: '找不到請款單' }, { status: 404 })
    if (report.status !== 'SUBMITTED') {
      return NextResponse.json({ error: `目前狀態 ${report.status}，無法退回` }, { status: 400 })
    }

    if (report.approvalRequestId) {
      await prisma.approvalRequest.update({
        where: { id: report.approvalRequestId },
        data: { status: 'REJECTED', completedAt: new Date(), notes: reason },
      })
    }

    const updated = await prisma.expenseReport.update({
      where: { id },
      data: { status: 'REJECTED', notes: reason },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'expenses', action: 'REJECT', entityType: 'ExpenseReport',
      entityId: id, entityLabel: report.reportNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'expenses.[id].reject')
  }
}
