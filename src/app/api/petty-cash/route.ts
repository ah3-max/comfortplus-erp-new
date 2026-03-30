import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

const ADMIN_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

async function generateRecordNo(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `PC-${year}${month}-`

  const startOfMonth = new Date(year, now.getMonth(), 1)
  const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999)

  const count = await prisma.pettyCashRecord.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `${prefix}${seq}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)

  try {
    const { searchParams } = new URL(req.url)
    const fundId = searchParams.get('fundId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where = {
      ...(isAdmin ? {} : { submittedById: session.user.id }),
      ...(fundId ? { fundId } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.pettyCashRecord.findMany({
        where,
        include: {
          fund: { select: { name: true, holderName: true } },
          submittedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.pettyCashRecord.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'petty-cash.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { fundId, date, category, description, amount, vendor, receiptNo, receiptPhotos, notes } = body

    if (!fundId || !date || !category || !description || amount == null) {
      return NextResponse.json({ error: '請填寫帳戶、日期、類別、說明及金額' }, { status: 400 })
    }

    const fund = await prisma.pettyCashFund.findUnique({ where: { id: fundId } })
    if (!fund) return NextResponse.json({ error: '零用金帳戶不存在' }, { status: 404 })
    if (!fund.isActive) return NextResponse.json({ error: '零用金帳戶已停用' }, { status: 400 })

    const recordNo = await generateRecordNo()

    const [record] = await prisma.$transaction([
      prisma.pettyCashRecord.create({
        data: {
          fundId,
          recordNo,
          date: new Date(date),
          category,
          description,
          amount: Number(amount),
          vendor: vendor || null,
          receiptNo: receiptNo || null,
          receiptPhotos: receiptPhotos || null,
          notes: notes || null,
          submittedById: session.user.id,
        },
        include: {
          fund: { select: { name: true, holderName: true } },
          submittedBy: { select: { name: true } },
        },
      }),
      prisma.pettyCashFund.update({
        where: { id: fundId },
        data: { balance: { decrement: Number(amount) } },
      }),
    ])

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'petty-cash.POST')
  }
}
