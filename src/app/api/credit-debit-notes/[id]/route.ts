import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const record = await prisma.creditDebitNote.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true } } },
    })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'credit-debit-notes.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const existing = await prisma.creditDebitNote.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.action === 'APPROVE') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json({ error: '只有草稿可核准' }, { status: 400 })
      }
      const updated = await prisma.creditDebitNote.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: session.user.id, approvedAt: new Date() },
      })
      logAudit({
        userId: session.user.id, userName: session.user.name ?? '',
        userRole: (session.user as { role?: string }).role ?? '',
        module: 'credit-debit-notes', action: 'APPROVE',
        entityType: 'CreditDebitNote', entityId: id, entityLabel: existing.noteNo,
      }).catch(() => {})
      return NextResponse.json(updated)
    }

    if (body.action === 'VOID') {
      if (!['DRAFT', 'APPROVED'].includes(existing.status)) {
        return NextResponse.json({ error: '此狀態無法作廢' }, { status: 400 })
      }
      const updated = await prisma.creditDebitNote.update({
        where: { id },
        data: { status: 'VOIDED' },
      })
      return NextResponse.json(updated)
    }

    // 草稿可更新
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只有草稿可編輯' }, { status: 400 })
    }

    const updated = await prisma.creditDebitNote.update({
      where: { id },
      data: {
        ...(body.reason !== undefined && { reason: body.reason }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        ...(body.taxAmount !== undefined && { taxAmount: Number(body.taxAmount) }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.amount !== undefined && {
          totalAmount: Number(body.amount) + Number(body.taxAmount ?? existing.taxAmount ?? 0),
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'credit-debit-notes.[id].PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await prisma.creditDebitNote.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只有草稿可刪除' }, { status: 400 })
    }
    await prisma.creditDebitNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'credit-debit-notes.[id].DELETE')
  }
}
