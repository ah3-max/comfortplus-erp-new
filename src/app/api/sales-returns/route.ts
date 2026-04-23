import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { buildScopeContext, canAccessOrder, isOwnDataOnly } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    // Scope: SALES/CS/CARE_SUPERVISOR only see returns for orders they can access
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    const scopeFilter = isOwnDataOnly(ctx.role) ? {
      order: {
        OR: [
          { createdById: ctx.userId },
          { customer: { salesRepId: ctx.userId } },
        ],
      },
    } : {}

    const where = {
      ...scopeFilter,
      ...(search && {
        OR: [
          { returnNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(status && { status: status as never }),
    }

    const [records, total] = await Promise.all([
      prisma.returnOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          order: { select: { id: true, orderNo: true } },
          items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.returnOrder.count({ where }),
    ])

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'sales-returns.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { orderId, customerId, returnType, reason, returnCategory, disposalMethod,
      responsibility, refundAmount, notes, items } = body

    if (!orderId || !customerId) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    // Verify user can access the target order (prevents SALES from filing returns on others' orders)
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, createdById: true, customer: { select: { salesRepId: true } } },
    })
    if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })
    if (order.customerId !== customerId) {
      return NextResponse.json({ error: '訂單與客戶不符' }, { status: 400 })
    }
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (!canAccessOrder(ctx, order)) {
      return NextResponse.json({ error: '無權限對此訂單建立退貨' }, { status: 403 })
    }

    const returnNo = await generateSequenceNo('SALES_RETURN')

    const record = await prisma.returnOrder.create({
      data: {
        returnNo,
        orderId,
        customerId,
        returnType: returnType ?? 'RETURN',
        reason,
        returnCategory,
        disposalMethod,
        responsibility,
        refundAmount: refundAmount ? Number(refundAmount) : null,
        refundStatus: refundAmount ? 'PENDING' : null,
        notes,
        createdById: session.user.id,
        items: {
          create: (items ?? []).map((item: { productId: string; quantity: number; batchNo?: string; reason?: string; condition?: string; notes?: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            batchNo: item.batchNo,
            reason: item.reason,
            condition: item.condition,
            notes: item.notes,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, orderNo: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'sales-returns',
      action: 'CREATE',
      entityType: 'ReturnOrder',
      entityId: record.id,
      entityLabel: returnNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'sales-returns.POST')
  }
}
