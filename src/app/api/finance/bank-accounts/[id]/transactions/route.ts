import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where = {
      bankAccountId: id,
      ...(startDate && { txDate: { gte: new Date(startDate) } }),
      ...(endDate && { txDate: { lte: new Date(endDate) } }),
    }

    const [records, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: [{ txDate: 'asc' }, { createdAt: 'asc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.bankTransaction.count({ where }),
    ])

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'bank-accounts.[id].transactions.GET')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { txDate, description, direction, amount, referenceNo, category, notes } = body

    if (!txDate || !description || !direction || !amount) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const account = await prisma.bankAccount.findUnique({ where: { id } })
    if (!account) return NextResponse.json({ error: '找不到銀行帳戶' }, { status: 404 })

    const txAmount = Number(amount)
    const balanceDelta = direction === 'CREDIT' ? txAmount : -txAmount
    const newBalance = Number(account.currentBalance) + balanceDelta

    const [tx] = await prisma.$transaction([
      prisma.bankTransaction.create({
        data: {
          bankAccountId: id,
          txDate: new Date(txDate),
          description,
          direction,
          amount: txAmount,
          balance: newBalance,
          referenceNo,
          category,
          notes,
          createdById: session.user.id,
        },
      }),
      prisma.bankAccount.update({
        where: { id },
        data: { currentBalance: newBalance },
      }),
    ])

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'bank-accounts',
      action: 'CREATE_TX',
      entityType: 'BankTransaction',
      entityId: tx.id,
      entityLabel: `${account.accountName} ${direction} ${txAmount}`,
    }).catch(() => {})

    return NextResponse.json(tx, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'bank-accounts.[id].transactions.POST')
  }
}
