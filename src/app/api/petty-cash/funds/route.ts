import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ADMIN_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)

  try {
    const where = isAdmin
      ? {}
      : { holderId: session.user.id }

    const data = await prisma.pettyCashFund.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'petty-cash.funds.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, holderName, holderId, department, balance, limit, currency, isActive, notes } = body

    if (!name || !holderName) {
      return NextResponse.json({ error: '請填寫名稱與持有人姓名' }, { status: 400 })
    }

    const fund = await prisma.pettyCashFund.create({
      data: {
        name,
        holderName,
        holderId: holderId || null,
        department: department || null,
        balance: balance != null ? balance : 0,
        limit: limit != null ? limit : 5000,
        currency: currency || 'TWD',
        isActive: isActive !== undefined ? isActive : true,
        notes: notes || null,
      },
    })

    return NextResponse.json(fund, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'petty-cash.funds.POST')
  }
}
