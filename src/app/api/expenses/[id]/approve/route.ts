import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const APPROVER_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'FINANCE']

/**
 * POST /api/expenses/:id/approve
 * Multi-step: advance currentStep; on final step → APPROVED + create provisional journal.
 * Simple (no steps): directly APPROVED.
 * Body: { comment? }
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
    const comment: string = body.comment ?? ''

    const report = await prisma.expenseReport.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!report) return NextResponse.json({ error: '找不到請款單' }, { status: 404 })
    if (report.status !== 'SUBMITTED') {
      return NextResponse.json({ error: `目前狀態 ${report.status}，無法審核` }, { status: 400 })
    }

    // Load approval request with steps
    const approvalReq = report.approvalRequestId
      ? await prisma.approvalRequest.findUnique({
          where: { id: report.approvalRequestId },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
      : null

    const hasSteps = approvalReq && approvalReq.steps.length > 0
    let isFinalStep = true
    let stepMessage = ''

    if (hasSteps) {
      // Find current step
      const currentStepRecord = approvalReq.steps.find(
        s => s.stepOrder === approvalReq.currentStep && s.status === 'PENDING'
      )
      if (!currentStepRecord) {
        return NextResponse.json({ error: '找不到待審核步驟' }, { status: 400 })
      }

      // Mark current step as approved
      await prisma.approvalStep.update({
        where: { id: currentStepRecord.id },
        data: {
          status:     'APPROVED',
          action:     'APPROVE',
          approverId: session.user.id,
          comment:    comment || null,
          actedAt:    new Date(),
        },
      })

      // Check if there's a next step
      const nextStep = approvalReq.steps.find(
        s => s.stepOrder > approvalReq.currentStep && s.status === 'PENDING'
      )

      if (nextStep) {
        // Advance to next step
        isFinalStep = false
        await prisma.approvalRequest.update({
          where: { id: approvalReq.id },
          data: { currentStep: nextStep.stepOrder },
        })
        stepMessage = `已核准第 ${approvalReq.currentStep} 關「${currentStepRecord.stepName}」，待第 ${nextStep.stepOrder} 關「${nextStep.stepName}」審核`
      } else {
        // Final step — mark approved
        await prisma.approvalRequest.update({
          where: { id: approvalReq.id },
          data: { status: 'APPROVED', completedAt: new Date(), notes: comment || null },
        })
      }
    } else {
      // Simple approval (no steps)
      if (approvalReq) {
        await prisma.approvalRequest.update({
          where: { id: approvalReq.id },
          data: { status: 'APPROVED', completedAt: new Date(), notes: comment || null },
        })
      }
    }

    if (isFinalStep) {
      // Mark report as APPROVED
      await prisma.expenseReport.update({
        where: { id },
        data: {
          status:       'APPROVED',
          approvedById: session.user.id,
          approvedAt:   new Date(),
        },
      })

      // Create provisional journal entry: Dr expense accounts / Cr 2170 (accrued expenses)
      await createProvisionalJournal(id, report.items, Number(report.totalAmount), session.user.id)

      stepMessage = '已核准（最終關）'
    } else {
      // Keep status as SUBMITTED, waiting for next step
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'expenses', action: 'APPROVE', entityType: 'ExpenseReport',
      entityId: id, entityLabel: report.reportNo,
    }).catch(() => {})

    const updated = await prisma.expenseReport.findUnique({ where: { id } })
    return NextResponse.json({ ...updated, stepMessage })
  } catch (error) {
    return handleApiError(error, 'expenses.[id].approve')
  }
}

/**
 * Create a provisional (DRAFT) journal entry for the approved expense report.
 * Dr: Each expense category's GL account
 * Cr: 2170 (其他應付款 / Accrued Expenses)
 */
async function createProvisionalJournal(
  reportId: string,
  items: Array<{ category: string; amount: unknown; glAccountCode: string | null; lineNo: number }>,
  totalAmount: number,
  createdById: string,
) {
  try {
    // Load category mappings
    const mappings = await prisma.expenseCategoryMapping.findMany({ where: { isActive: true } })
    const categoryMap = new Map(mappings.map(m => [m.category, m.accountCode]))

    // Resolve account codes for each item
    const lineItems: Array<{ accountCode: string; amount: number; description: string }> = []
    for (const item of items) {
      const code = item.glAccountCode ?? categoryMap.get(item.category) ?? '6000'
      const existing = lineItems.find(l => l.accountCode === code)
      if (existing) {
        existing.amount += Number(item.amount)
      } else {
        lineItems.push({ accountCode: code, amount: Number(item.amount), description: item.category })
      }
    }

    // Find account IDs
    const codes = [...new Set([...lineItems.map(l => l.accountCode), '2170'])]
    const accounts = await prisma.accountingAccount.findMany({
      where: { code: { in: codes }, isActive: true },
      select: { id: true, code: true },
    })
    const acctMap = new Map(accounts.map(a => [a.code, a.id]))

    const crAccountId = acctMap.get('2170')
    if (!crAccountId) return // No accrued expenses account → skip

    const entryNo = await generateSequenceNo('JOURNAL_ENTRY')

    // Build debit lines
    const debitLines = lineItems.map((l, i) => ({
      accountId:   acctMap.get(l.accountCode) ?? acctMap.get('6000')!,
      debit:       l.amount,
      credit:      0,
      description: `費用報銷 — ${l.description}`,
      lineNo:      i + 1,
    })).filter(l => l.accountId)

    // Credit line: 2170
    const creditLine = {
      accountId:   crAccountId,
      debit:       0,
      credit:      totalAmount,
      description: '費用報銷暫估',
      lineNo:      debitLines.length + 1,
    }

    const totalDebit = debitLines.reduce((s, l) => s + l.debit, 0)

    const entry = await prisma.journalEntry.create({
      data: {
        entryNo,
        entryDate:     new Date(),
        description:   `費用報銷暫估`,
        status:        'DRAFT',
        entryType:     'AUTO',
        referenceType: 'EXPENSE_REPORT',
        referenceId:   reportId,
        totalDebit,
        totalCredit:   totalAmount,
        createdById,
        lines: { create: [...debitLines, creditLine] },
      },
    })

    // Link journal entry to expense report
    await prisma.expenseReport.update({
      where: { id: reportId },
      data: { journalEntryId: entry.id },
    })
  } catch {
    // Non-critical: don't fail the approval if journal creation fails
  }
}
