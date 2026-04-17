import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { createAutoJournal } from '@/lib/auto-journal'

const CASHIER_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/**
 * POST /api/expenses/:id/pay
 * 出納標記已付款，狀態 APPROVED → PAID
 *
 * If a provisional journal exists (journalEntryId):
 *   1. Post the provisional journal (DRAFT → POSTED)
 *   2. Create a payment journal: Dr 2170 / Cr 1102 (settle accrued → bank)
 * Else (backward compatible):
 *   Create auto-journal EXPENSE_PAY (Dr 6000 / Cr 1102)
 *
 * Body: { paidAt? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!CASHIER_ROLES.includes(role)) {
    return NextResponse.json({ error: '僅出納/財務可執行付款' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()

    const report = await prisma.expenseReport.findUnique({
      where: { id },
      include: { submittedBy: { select: { name: true } } },
    })
    if (!report) return NextResponse.json({ error: '找不到請款單' }, { status: 404 })
    if (report.status !== 'APPROVED') {
      return NextResponse.json({ error: `目前狀態 ${report.status}，需先核准才能付款` }, { status: 400 })
    }

    // Update status
    const updated = await prisma.expenseReport.update({
      where: { id },
      data: { status: 'PAID', paidAt },
    })

    if (report.journalEntryId) {
      // Has provisional journal → post it and create settlement entry
      // 1. Post provisional journal (Dr expense / Cr 2170)
      await prisma.journalEntry.update({
        where: { id: report.journalEntryId },
        data: { status: 'POSTED', postedAt: paidAt, postedById: session.user.id },
      })

      // 2. Create payment journal: Dr 2170 (settle accrued) / Cr 1102 (bank)
      await createPaymentJournal(id, Number(report.totalAmount), paidAt, session.user.id, report.reportNo)
    } else {
      // Backward compatible: single auto-journal Dr 6000 / Cr 1102
      await createAutoJournal({
        type:          'EXPENSE_PAY',
        referenceType: 'ExpenseReport',
        referenceId:   id,
        entryDate:     paidAt,
        description:   `費用報銷—${report.submittedBy.name}—${report.reportNo}`,
        amount:        Number(report.totalAmount),
        taxAmount:     0,
        createdById:   session.user.id,
      })
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'expenses', action: 'PAY', entityType: 'ExpenseReport',
      entityId: id, entityLabel: report.reportNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'expenses.[id].pay')
  }
}

/**
 * Create a payment journal: Dr 2170 (其他應付款) / Cr 1102 (銀行存款)
 * This settles the accrued expense from the provisional journal.
 */
async function createPaymentJournal(
  reportId: string,
  totalAmount: number,
  entryDate: Date,
  createdById: string,
  reportNo: string,
) {
  try {
    const { generateSequenceNo } = await import('@/lib/sequence')

    const accounts = await prisma.accountingAccount.findMany({
      where: { code: { in: ['2170', '1102', '1100'] }, isActive: true },
      select: { id: true, code: true },
    })
    const acctMap = new Map(accounts.map(a => [a.code, a.id]))
    const drId = acctMap.get('2170')
    const crId = acctMap.get('1102') ?? acctMap.get('1100')
    if (!drId || !crId) return

    const entryNo = await generateSequenceNo('JOURNAL_ENTRY')

    await prisma.journalEntry.create({
      data: {
        entryNo,
        entryDate,
        description: `費用報銷付款 — ${reportNo}`,
        status:      'POSTED',
        entryType:   'AUTO',
        referenceType: 'EXPENSE_PAYMENT',
        referenceId: reportId,
        totalDebit:  totalAmount,
        totalCredit: totalAmount,
        postedAt:    entryDate,
        postedById:  createdById,
        createdById,
        lines: {
          create: [
            { accountId: drId, debit: totalAmount, credit: 0, description: '沖銷費用暫估', lineNo: 1 },
            { accountId: crId, debit: 0, credit: totalAmount, description: '銀行存款付款', lineNo: 2 },
          ],
        },
      },
    })
  } catch {
    // Non-critical
  }
}
