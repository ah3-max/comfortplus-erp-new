import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const accountType = searchParams.get('accountType') ?? ''
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const where = {
      ...(accountType && { accountType }),
      ...(activeOnly && { isActive: true }),
    }

    const records = await prisma.bankAccount.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    return handleApiError(error, 'bank-accounts.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { accountName, accountNo, bankName, bankCode, accountType,
      currency, openingBalance, creditLimit, statementDay, paymentDay, notes } = body

    if (!accountName || !accountNo || !bankName) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const record = await prisma.bankAccount.create({
      data: {
        accountName,
        accountNo,
        bankName,
        bankCode,
        accountType: accountType ?? 'CHECKING',
        currency: currency ?? 'TWD',
        openingBalance: openingBalance ? Number(openingBalance) : 0,
        currentBalance: openingBalance ? Number(openingBalance) : 0,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        statementDay: statementDay ? Number(statementDay) : null,
        paymentDay: paymentDay ? Number(paymentDay) : null,
        notes,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'bank-accounts',
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: record.id,
      entityLabel: `${record.bankName} ${record.accountNo}`,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'bank-accounts.POST')
  }
}
