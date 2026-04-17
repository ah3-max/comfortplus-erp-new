import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

/**
 * POST /api/expenses/:id/submit
 * 員工提交費用請款單，狀態 DRAFT → SUBMITTED
 * 若有 EXPENSE_REPORT ApprovalTemplate → 建立多步驟 ApprovalRequest + ApprovalSteps
 * 否則建立簡單 ApprovalRequest (向下相容)
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const report = await prisma.expenseReport.findUnique({ where: { id } })
    if (!report) return NextResponse.json({ error: '找不到請款單' }, { status: 404 })
    if (report.submittedById !== session.user.id) {
      return NextResponse.json({ error: '只能提交自己的請款單' }, { status: 403 })
    }
    if (report.status !== 'DRAFT') {
      return NextResponse.json({ error: `目前狀態 ${report.status}，無法提交` }, { status: 400 })
    }

    // Look for active EXPENSE_REPORT approval template
    const template = await prisma.approvalTemplate.findFirst({
      where: { module: 'EXPENSE_REPORT', isActive: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    let approval
    if (template && template.steps.length > 0) {
      // Multi-step approval
      approval = await prisma.approvalRequest.create({
        data: {
          requestNo:     `EXP-APV-${Date.now()}`,
          templateId:    template.id,
          module:        'EXPENSE_REPORT',
          entityId:      id,
          entityLabel:   report.reportNo,
          status:        'PENDING',
          currentStep:   1,
          requestedById: session.user.id,
          steps: {
            create: template.steps.map(s => ({
              stepOrder:  s.stepOrder,
              stepName:   s.stepName,
              status:     'PENDING',
            })),
          },
        },
      })
    } else {
      // Simple approval (backward compatible)
      approval = await prisma.approvalRequest.create({
        data: {
          requestNo:     `EXP-APV-${Date.now()}`,
          module:        'EXPENSE',
          entityId:      id,
          entityLabel:   report.reportNo,
          status:        'PENDING',
          requestedById: session.user.id,
        },
      })
    }

    const updated = await prisma.expenseReport.update({
      where: { id },
      data: {
        status:            'SUBMITTED',
        approvalRequestId: approval.id,
        submittedAt:       new Date(),
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'expenses', action: 'SUBMIT', entityType: 'ExpenseReport',
      entityId: id, entityLabel: report.reportNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'expenses.[id].submit')
  }
}
