import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { generateSequenceNo } from '@/lib/sequence'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['PROCUREMENT', 'FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const { searchParams } = req.nextUrl
    const planYear = searchParams.get('planYear')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where: Record<string, unknown> = {}
    if (planYear) where.planYear = Number(planYear)

    const [data, total] = await Promise.all([
      prisma.purchasePlan.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              supplier: { select: { id: true, name: true } },
            },
            orderBy: { lineNo: 'asc' },
          },
        },
        orderBy: [{ planYear: 'desc' }, { planMonth: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchasePlan.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'purchase-plans.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['PROCUREMENT', 'FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { planYear, planMonth, notes, items } = body

    if (!planYear || !planMonth || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '年度、月份及至少一筆項目為必填' }, { status: 400 })
    }

    const planNo = await generateSequenceNo('PURCHASE_PLAN')

    const totalBudget = items.reduce(
      (sum: number, item: { requiredQty: number; unitPrice?: number }) =>
        sum + item.requiredQty * (item.unitPrice ?? 0),
      0,
    )

    const plan = await prisma.purchasePlan.create({
      data: {
        planNo,
        planYear: Number(planYear),
        planMonth: Number(planMonth),
        totalBudget,
        notes: notes ?? null,
        createdById: session.user.id,
        items: {
          create: items.map((item: {
            productId: string
            requiredQty: number
            unitPrice?: number
            supplierId?: string
            expectedDate?: string
            notes?: string
          }, idx: number) => ({
            productId: item.productId,
            requiredQty: item.requiredQty,
            unitPrice: item.unitPrice ?? null,
            supplierId: item.supplierId ?? null,
            expectedDate: item.expectedDate ? new Date(item.expectedDate) : null,
            notes: item.notes ?? null,
            lineNo: idx + 1,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'purchase-plans.POST')
  }
}
