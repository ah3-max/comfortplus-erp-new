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
    const record = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    })
    if (!record) return NextResponse.json({ error: '找不到銀行帳戶' }, { status: 404 })
    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'bank-accounts.[id].GET')
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
    const { accountName, bankName, bankCode, creditLimit, statementDay, paymentDay, isActive, notes } = body

    const record = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(accountName !== undefined && { accountName }),
        ...(bankName !== undefined && { bankName }),
        ...(bankCode !== undefined && { bankCode }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ? Number(creditLimit) : null }),
        ...(statementDay !== undefined && { statementDay: statementDay ? Number(statementDay) : null }),
        ...(paymentDay !== undefined && { paymentDay: paymentDay ? Number(paymentDay) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(notes !== undefined && { notes }),
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'bank-accounts',
      action: 'UPDATE',
      entityType: 'BankAccount',
      entityId: id,
      entityLabel: record.accountName,
    }).catch(() => {})

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'bank-accounts.[id].PUT')
  }
}
