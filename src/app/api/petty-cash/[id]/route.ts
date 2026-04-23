import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const ADMIN_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)

  try {
    const { id } = await params
    const record = await prisma.pettyCashRecord.findUnique({
      where: { id },
      include: {
        fund: { select: { name: true, holderName: true } },
        submittedBy: { select: { name: true } },
      },
    })

    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!isAdmin && record.submittedById !== session.user.id) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'petty-cash.GET_ONE')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)

  try {
    const { id } = await params
    const body = await req.json()

    const record = await prisma.pettyCashRecord.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = record.submittedById === session.user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    if (!isAdmin && isOwner && record.status !== 'PENDING') {
      return NextResponse.json({ error: '只能編輯待確認的記錄' }, { status: 400 })
    }

    // Build update payload
    const updateData: Record<string, unknown> = {}

    // Fields editable by submitter (when PENDING)
    if (isOwner || isAdmin) {
      if (body.description !== undefined) updateData.description = body.description
      if (body.notes !== undefined) updateData.notes = body.notes || null
      if (body.receiptPhotos !== undefined) updateData.receiptPhotos = body.receiptPhotos || null
      if (body.hasReceipt !== undefined) updateData.hasReceipt = body.hasReceipt
      if (body.vendor !== undefined) updateData.vendor = body.vendor || null
      if (body.receiptNo !== undefined) updateData.receiptNo = body.receiptNo || null
    }

    // Fields editable by admin only: status, reviewNote
    if (isAdmin) {
      if (body.reviewNote !== undefined) updateData.reviewNote = body.reviewNote || null

      if (body.status && body.status !== record.status) {
        const validStatuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'REIMBURSED']
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json({ error: '無效的狀態值' }, { status: 400 })
        }
        updateData.status = body.status
        updateData.reviewedById = session.user.id
        updateData.reviewedAt = new Date()

        // Handle balance side-effects in a transaction
        if (body.status === 'REJECTED') {
          // Restore balance when rejected
          const [updated] = await prisma.$transaction([
            prisma.pettyCashRecord.update({
              where: { id },
              data: updateData,
            }),
            prisma.pettyCashFund.update({
              where: { id: record.fundId },
              data: { balance: { increment: Number(record.amount) } },
            }),
          ])
          logAudit({
            userId: session.user.id, userName: session.user.name ?? '', userRole: role,
            module: 'petty-cash', action: 'REJECT',
            entityType: 'PettyCashRecord', entityId: id, entityLabel: record.recordNo,
            changes: { status: { before: record.status, after: 'REJECTED' } },
          }).catch(() => {})
          return NextResponse.json(updated)
        }

        if (body.status === 'REIMBURSED') {
          // Add reimbursement amount to fund balance
          const reimburseAmount = body.reimburseAmount != null
            ? Number(body.reimburseAmount)
            : Number(record.amount)
          const [updated] = await prisma.$transaction([
            prisma.pettyCashRecord.update({
              where: { id },
              data: updateData,
            }),
            prisma.pettyCashFund.update({
              where: { id: record.fundId },
              data: { balance: { increment: reimburseAmount } },
            }),
          ])
          logAudit({
            userId: session.user.id, userName: session.user.name ?? '', userRole: role,
            module: 'petty-cash', action: 'REIMBURSE',
            entityType: 'PettyCashRecord', entityId: id, entityLabel: `${record.recordNo} — ${reimburseAmount}`,
            changes: { status: { before: record.status, after: 'REIMBURSED' } },
          }).catch(() => {})
          return NextResponse.json(updated)
        }
      }
    }

    const updated = await prisma.pettyCashRecord.update({
      where: { id },
      data: updateData,
      include: {
        fund: { select: { name: true, holderName: true } },
        submittedBy: { select: { name: true } },
      },
    })

    if (updateData.status && updateData.status !== record.status) {
      logAudit({
        userId: session.user.id, userName: session.user.name ?? '', userRole: role,
        module: 'petty-cash', action: 'STATUS_CHANGE',
        entityType: 'PettyCashRecord', entityId: id, entityLabel: record.recordNo,
        changes: { status: { before: record.status, after: updateData.status } },
      }).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'petty-cash.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)

  try {
    const { id } = await params
    const record = await prisma.pettyCashRecord.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = record.submittedById === session.user.id

    if (!isAdmin && !(isOwner && record.status === 'PENDING')) {
      return NextResponse.json({ error: '只能刪除自己的待確認記錄' }, { status: 403 })
    }

    // If the record is PENDING, restore balance before deleting
    if (record.status === 'PENDING') {
      await prisma.$transaction([
        prisma.pettyCashRecord.delete({ where: { id } }),
        prisma.pettyCashFund.update({
          where: { id: record.fundId },
          data: { balance: { increment: Number(record.amount) } },
        }),
      ])
    } else {
      await prisma.pettyCashRecord.delete({ where: { id } })
    }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'petty-cash', action: 'DELETE',
      entityType: 'PettyCashRecord', entityId: id,
      entityLabel: `${record.recordNo} — ${record.description}`,
      changes: { amount: { before: Number(record.amount), after: null } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'petty-cash.DELETE')
  }
}
