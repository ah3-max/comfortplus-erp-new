import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const statement = await prisma.reconciliationStatement.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true, code: true, taxId: true, address: true, contactPerson: true, phone: true } } },
    })
    if (!statement) return NextResponse.json({ error: '對帳單不存在' }, { status: 404 })
    return NextResponse.json(statement)
  } catch (error) {
    return handleApiError(error, 'statements.GET.id')
  }
}

/**
 * PUT /api/statements/[id]
 * Actions: SEND (DRAFT→SENT), CONFIRM (SENT→CONFIRMED), DISPUTE, VOID
 * Also: update notes, disputeNote, totalAdjustment
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'CS'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { action, notes, disputeNote, totalAdjustment } = body

    const current = await prisma.reconciliationStatement.findUnique({
      where: { id },
      select: { id: true, statementNo: true, status: true, openingBalance: true, totalBilled: true, totalReceived: true, totalAdjustment: true },
    })
    if (!current) return NextResponse.json({ error: '對帳單不存在' }, { status: 404 })

    const updates: Record<string, unknown> = {}

    if (action === 'SEND') {
      if (current.status !== 'DRAFT') return NextResponse.json({ error: '只有草稿可寄出' }, { status: 400 })
      updates.status = 'SENT'
    } else if (action === 'CONFIRM') {
      updates.status = 'CONFIRMED'
      updates.customerConfirmedAt = new Date()
    } else if (action === 'DISPUTE') {
      updates.status = 'DISPUTED'
      if (disputeNote) updates.disputeNote = disputeNote
    } else if (action === 'VOID') {
      if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
        return NextResponse.json({ error: '只有財務可作廢對帳單' }, { status: 403 })
      }
      updates.status = 'VOID'
    }

    if (notes !== undefined) updates.notes = notes
    if (totalAdjustment !== undefined) {
      updates.totalAdjustment = totalAdjustment
      // Recalculate closing balance
      updates.closingBalance = Number(current.openingBalance) + Number(current.totalBilled) - Number(current.totalReceived) - Number(totalAdjustment)
    }

    const updated = await prisma.reconciliationStatement.update({
      where: { id },
      data: updates,
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'statements',
      action: 'UPDATE',
      entityType: 'ReconciliationStatement',
      entityId: id,
      entityLabel: current.statementNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'statements.PUT.id')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '只有財務可刪除對帳單' }, { status: 403 })
  }

  try {
    const { id } = await params
    const s = await prisma.reconciliationStatement.findUnique({ where: { id }, select: { status: true, statementNo: true } })
    if (!s) return NextResponse.json({ error: '不存在' }, { status: 404 })
    if (s.status !== 'DRAFT') return NextResponse.json({ error: '只有草稿可刪除' }, { status: 400 })
    await prisma.reconciliationStatement.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'statements.DELETE.id')
  }
}
