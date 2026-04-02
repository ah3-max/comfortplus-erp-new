import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

  const role = (session.user as { role?: string }).role ?? ''
  const isFinance = ['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)

  const where = {
    // 非財務人員只能看自己提交的
    ...(!isFinance && { submittedById: session.user.id }),
    ...(search && {
      OR: [
        { reportNo: { contains: search, mode: 'insensitive' as const } },
        { title: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(status && { status }),
  }

  const [data, total] = await Promise.all([
    prisma.expenseReport.findMany({
      where,
      include: {
        items: true,
        submittedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.expenseReport.count({ where }),
  ])

  return NextResponse.json({
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (!body.title) {
      return NextResponse.json({ error: '請輸入報銷標題' }, { status: 400 })
    }
    if (!body.items?.length) {
      return NextResponse.json({ error: '請至少新增一筆費用項目' }, { status: 400 })
    }

    const totalAmount = body.items.reduce(
      (sum: number, item: { amount: number }) => sum + Number(item.amount),
      0
    )

    const reportNo = await generateSequenceNo('EXPENSE_REPORT')

    const report = await prisma.expenseReport.create({
      data: {
        reportNo,
        title: body.title,
        department: body.department || null,
        status: 'DRAFT',
        totalAmount,
        currency: body.currency ?? 'TWD',
        notes: body.notes || null,
        submittedById: session.user.id,
        items: {
          create: body.items.map((item: {
            date: string
            category: string
            description: string
            amount: number
            receiptUrl?: string
          }, idx: number) => ({
            date: new Date(item.date),
            category: item.category,
            description: item.description,
            amount: Number(item.amount),
            receiptUrl: item.receiptUrl || null,
            lineNo: idx + 1,
          })),
        },
      },
      include: {
        items: true,
        submittedBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'expenses',
      action: 'CREATE',
      entityType: 'ExpenseReport',
      entityId: report.id,
      entityLabel: reportNo,
    }).catch(() => {})

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'expenses.POST')
  }
}
