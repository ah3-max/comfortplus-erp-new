import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.contract.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      schedules: { orderBy: { dueDate: 'asc' } },
      renewals: { orderBy: { renewedAt: 'desc' } },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const current = await prisma.contract.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const role = (session.user as { role?: string }).role ?? ''

    // Mark payment schedule as paid
    if (body.action === 'PAY_SCHEDULE') {
      const updated = await prisma.contractPaySchedule.update({
        where: { id: body.scheduleId },
        data: { isPaid: true, paidAt: new Date() },
      })
      return NextResponse.json(updated)
    }

    // Renew contract
    if (body.action === 'RENEW') {
      if (!body.newEffectiveTo) return NextResponse.json({ error: '請填寫新到期日' }, { status: 400 })
      await prisma.$transaction(async (tx) => {
        await tx.contractRenewal.create({
          data: {
            contractId: id,
            newEffectiveTo: new Date(body.newEffectiveTo),
            notes: body.notes || null,
          },
        })
        await tx.contract.update({
          where: { id },
          data: { effectiveTo: new Date(body.newEffectiveTo), status: 'ACTIVE' },
        })
      })
      logAudit({ userId: session.user.id, userName: session.user.name ?? '', userRole: role, module: 'contracts', action: 'RENEW', entityType: 'Contract', entityId: id, entityLabel: current.contractNo }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    // Terminate
    if (body.action === 'TERMINATE') {
      await prisma.contract.update({ where: { id }, data: { status: 'TERMINATED' } })
      return NextResponse.json({ success: true })
    }

    // Update fields
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        contractType: body.contractType ?? undefined,
        status: body.status ?? undefined,
        totalValue: body.totalValue !== undefined ? (body.totalValue === null ? null : Number(body.totalValue)) : undefined,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        paymentTerms: body.paymentTerms !== undefined ? (body.paymentTerms || null) : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
        autoRenew: body.autoRenew ?? undefined,
        reminderDays: body.reminderDays ?? undefined,
      },
    })

    logAudit({ userId: session.user.id, userName: session.user.name ?? '', userRole: role, module: 'contracts', action: 'UPDATE', entityType: 'Contract', entityId: id, entityLabel: current.contractNo }).catch(() => {})
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'contracts.PUT')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const current = await prisma.contract.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (current.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能刪除草稿狀態的合約' }, { status: 400 })
    }

    const role = (session.user as { role?: string }).role ?? ''
    await prisma.contract.delete({ where: { id } })
    logAudit({ userId: session.user.id, userName: session.user.name ?? '', userRole: role, module: 'contracts', action: 'DELETE', entityType: 'Contract', entityId: id, entityLabel: current.contractNo }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'contracts.DELETE')
  }
}
