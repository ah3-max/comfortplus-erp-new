import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { createAutoJournal } from '@/lib/auto-journal'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const report = await prisma.expenseReport.findUnique({
    where: { id },
    include: {
      items: { orderBy: { lineNo: 'asc' } },
      submittedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  })

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(report)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const action = body.action as string | undefined

    const existing = await prisma.expenseReport.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const role = (session.user as { role?: string }).role ?? ''

    // ── SUBMIT: DRAFT → SUBMITTED ──
    if (action === 'SUBMIT') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json({ error: '只有草稿狀態可以提交' }, { status: 400 })
      }

      const report = await prisma.expenseReport.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'expenses',
        action: 'SUBMIT',
        entityType: 'ExpenseReport',
        entityId: id,
        entityLabel: existing.reportNo,
        changes: { status: { before: 'DRAFT', after: 'SUBMITTED' } },
      }).catch(() => {})

      return NextResponse.json(report)
    }

    // ── APPROVE: SUBMITTED → APPROVED ──
    if (action === 'APPROVE') {
      if (existing.status !== 'SUBMITTED') {
        return NextResponse.json({ error: '只有已提交狀態可以核准' }, { status: 400 })
      }
      if (!['FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
        return NextResponse.json({ error: '無權限核准費用報銷' }, { status: 403 })
      }

      const report = await prisma.expenseReport.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'expenses',
        action: 'APPROVE',
        entityType: 'ExpenseReport',
        entityId: id,
        entityLabel: existing.reportNo,
        changes: { status: { before: 'SUBMITTED', after: 'APPROVED' } },
      }).catch(() => {})

      return NextResponse.json(report)
    }

    // ── REJECT: SUBMITTED → REJECTED ──
    if (action === 'REJECT') {
      if (existing.status !== 'SUBMITTED') {
        return NextResponse.json({ error: '只有已提交狀態可以駁回' }, { status: 400 })
      }

      const report = await prisma.expenseReport.update({
        where: { id },
        data: { status: 'REJECTED', notes: body.notes ?? existing.notes },
      })

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'expenses',
        action: 'REJECT',
        entityType: 'ExpenseReport',
        entityId: id,
        entityLabel: existing.reportNo,
        changes: { status: { before: 'SUBMITTED', after: 'REJECTED' } },
      }).catch(() => {})

      return NextResponse.json(report)
    }

    // ── PAY: APPROVED → PAID ──
    if (action === 'PAY') {
      if (existing.status !== 'APPROVED') {
        return NextResponse.json({ error: '只有已核准狀態可以付款' }, { status: 400 })
      }

      const reportWithItems = await prisma.expenseReport.findUnique({
        where: { id },
        include: { items: true },
      })
      const totalAmount = reportWithItems?.items.reduce((s, i) => s + Number(i.amount), 0) ?? 0

      const report = await prisma.expenseReport.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
      })

      // Auto journal: Dr 費用 / Cr 銀行存款
      if (totalAmount > 0) {
        createAutoJournal({
          type: 'EXPENSE_PAY',
          referenceType: 'EXPENSE_REPORT',
          referenceId: id,
          entryDate: new Date(),
          description: `費用報銷 ${existing.reportNo}`,
          amount: totalAmount,
          taxAmount: 0,
          createdById: session.user.id,
        }).catch(() => {})
      }

      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: role,
        module: 'expenses',
        action: 'PAY',
        entityType: 'ExpenseReport',
        entityId: id,
        entityLabel: existing.reportNo,
        changes: { status: { before: 'APPROVED', after: 'PAID' } },
      }).catch(() => {})

      return NextResponse.json(report)
    }

    // ── Default: update fields (title, notes, items) ──
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只有草稿狀態可以編輯' }, { status: 400 })
    }

    // If items provided, replace all items
    let report
    if (Array.isArray(body.items)) {
      const validItems = (body.items as Array<{ date: string; category: string; description: string; amount: number }>)
        .filter(i => i.description && Number(i.amount) > 0)
      const totalAmount = validItems.reduce((s, i) => s + Number(i.amount), 0)

      report = await prisma.$transaction(async tx => {
        await tx.expenseItem.deleteMany({ where: { reportId: id } })
        return tx.expenseReport.update({
          where: { id },
          data: {
            title: body.title ?? existing.title,
            notes: body.notes ?? existing.notes,
            department: body.department !== undefined ? body.department : existing.department,
            totalAmount,
            items: {
              create: validItems.map((item, idx) => ({
                date: new Date(item.date),
                category: item.category,
                description: item.description,
                amount: item.amount,
                lineNo: idx + 1,
              })),
            },
          },
          include: { items: { orderBy: { lineNo: 'asc' } } },
        })
      })
    } else {
      report = await prisma.expenseReport.update({
        where: { id },
        data: {
          title: body.title ?? existing.title,
          notes: body.notes ?? existing.notes,
          department: body.department !== undefined ? body.department : existing.department,
        },
        include: { items: { orderBy: { lineNo: 'asc' } } },
      })
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'expenses',
      action: 'UPDATE',
      entityType: 'ExpenseReport',
      entityId: id,
      entityLabel: existing.reportNo,
    }).catch(() => {})

    return NextResponse.json(report)
  } catch (error) {
    return handleApiError(error, 'expenses.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能刪除草稿狀態的報銷單' }, { status: 400 })
    }

    await prisma.expenseReport.delete({ where: { id } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'expenses',
      action: 'DELETE',
      entityType: 'ExpenseReport',
      entityId: id,
      entityLabel: existing.reportNo,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'expenses.DELETE')
  }
}
