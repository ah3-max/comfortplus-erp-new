import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const record = await prisma.cheque.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    if (!record) return NextResponse.json({ error: '找不到支票' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'cheques.[id].GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { status, bankAccountId, depositedAt, clearedAt, returnReason, notes } = body

    const record = await prisma.cheque.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(bankAccountId !== undefined && { bankAccountId }),
        ...(depositedAt !== undefined && { depositedAt: depositedAt ? new Date(depositedAt) : null }),
        ...(clearedAt !== undefined && { clearedAt: clearedAt ? new Date(clearedAt) : null }),
        ...(returnReason !== undefined && { returnReason }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'cheques',
      action: 'UPDATE',
      entityType: 'Cheque',
      entityId: id,
      entityLabel: record.chequeNo,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'cheques.[id].PUT')
  }
}
