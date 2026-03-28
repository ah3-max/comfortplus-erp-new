import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [data, total] = await Promise.all([
      prisma.assetLoan.findMany({
        where,
        include: {
          borrower: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { borrowDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.assetLoan.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'asset-loans.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { assetName, assetCode, category, borrowerId, borrowDate, expectedReturnDate, notes } = body

    if (!assetName || !category || !borrowerId || !borrowDate) {
      return NextResponse.json({ error: '資產名稱、類別、借用人及借用日期為必填' }, { status: 400 })
    }

    const loan = await prisma.assetLoan.create({
      data: {
        assetName,
        assetCode: assetCode ?? null,
        category,
        borrowerId,
        borrowDate: new Date(borrowDate),
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        notes: notes ?? null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(loan, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'asset-loans.POST')
  }
}
