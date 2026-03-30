import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']
  if (!FINANCE_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || ''
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const data = await prisma.accountingAccount.findMany({
      where: {
        ...(type && { type }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ code: 'asc' }],
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'finance.accounts.GET')
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json()
    const { code, name, type, subType, normalBalance, parentCode, level, notes } = body

    if (!code || !name || !type) {
      return NextResponse.json({ error: '科目代碼、名稱、類型為必填' }, { status: 400 })
    }

    const account = await prisma.accountingAccount.create({
      data: {
        code, name, type,
        subType: subType || null,
        normalBalance: normalBalance || (type === 'REVENUE' || type === 'LIABILITY' || type === 'EQUITY' ? 'CREDIT' : 'DEBIT'),
        parentCode: parentCode || null,
        level: level || 1,
        notes: notes || null,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'finance.accounts.POST')
  }
}

export async function PUT(req: NextRequest) {
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
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    const account = await prisma.accountingAccount.update({
      where: { id },
      data: {
        name: data.name,
        subType: data.subType ?? null,
        isActive: data.isActive ?? undefined,
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    return handleApiError(error, 'finance.accounts.PUT')
  }
}
