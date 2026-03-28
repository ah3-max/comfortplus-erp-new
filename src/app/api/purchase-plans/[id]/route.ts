import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['PROCUREMENT', 'FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const { id } = await params

    const plan = await prisma.purchasePlan.findUnique({
      where: { id },
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
    })

    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(plan)
  } catch (error) {
    return handleApiError(error, 'purchase-plans.GET')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.purchasePlan.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // State machine actions
    if (body.action === 'SUBMIT') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json({ error: '只有草稿狀態可以提交' }, { status: 400 })
      }
      const plan = await prisma.purchasePlan.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      })
      return NextResponse.json(plan)
    }

    if (body.action === 'APPROVE') {
      if (existing.status !== 'SUBMITTED') {
        return NextResponse.json({ error: '只有已提交狀態可以核准' }, { status: 400 })
      }
      const plan = await prisma.purchasePlan.update({
        where: { id },
        data: { status: 'APPROVED' },
      })
      return NextResponse.json(plan)
    }

    if (body.action === 'EXECUTE') {
      if (existing.status !== 'APPROVED') {
        return NextResponse.json({ error: '只有已核准狀態可以執行' }, { status: 400 })
      }
      const plan = await prisma.purchasePlan.update({
        where: { id },
        data: { status: 'EXECUTED' },
      })
      return NextResponse.json(plan)
    }

    // General field update (DRAFT only)
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能編輯草稿狀態的採購計畫' }, { status: 400 })
    }

    const { planYear, planMonth, notes, items } = body
    const data: Record<string, unknown> = {}
    if (planYear !== undefined) data.planYear = Number(planYear)
    if (planMonth !== undefined) data.planMonth = Number(planMonth)
    if (notes !== undefined) data.notes = notes

    if (items && Array.isArray(items)) {
      const totalBudget = items.reduce(
        (sum: number, item: { requiredQty: number; unitPrice?: number }) =>
          sum + item.requiredQty * (item.unitPrice ?? 0),
        0,
      )
      data.totalBudget = totalBudget

      await prisma.purchasePlanItem.deleteMany({ where: { planId: id } })
      data.items = {
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
      }
    }

    const plan = await prisma.purchasePlan.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    return handleApiError(error, 'purchase-plans.PUT')
  }
}
