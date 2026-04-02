import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const record = await prisma.reconciliationStatement.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true } } },
    })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'reconciliation-statements.[id].GET')
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
    const existing = await prisma.reconciliationStatement.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updateData: Record<string, unknown> = {}

    if (body.action === 'CONFIRM') {
      updateData.status = 'CONFIRMED'
      updateData.customerConfirmedAt = new Date()
    } else if (body.action === 'DISPUTE') {
      updateData.status = 'DISPUTED'
      updateData.disputeNote = body.disputeNote ?? null
    } else {
      if (body.totalAdjustment !== undefined) updateData.totalAdjustment = body.totalAdjustment
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.totalAdjustment !== undefined) {
        updateData.closingBalance = Number(existing.openingBalance) + Number(existing.totalBilled)
          - Number(existing.totalReceived) + Number(body.totalAdjustment)
      }
    }

    const updated = await prisma.reconciliationStatement.update({ where: { id }, data: updateData })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'reconciliation-statements', action: body.action ?? 'UPDATE',
      entityType: 'ReconciliationStatement', entityId: id, entityLabel: existing.statementNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'reconciliation-statements.[id].PUT')
  }
}
