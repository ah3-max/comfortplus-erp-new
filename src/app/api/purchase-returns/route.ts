import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSequenceNo } from '@/lib/sequence'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    const where = {
      ...(search && {
        OR: [
          { returnNo: { contains: search, mode: 'insensitive' as const } },
          { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(status && { status: status as never }),
    }

    const [records, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          purchase: { select: { id: true, poNo: true } },
          items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.purchaseReturn.count({ where }),
    ])

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'purchase-returns.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { purchaseId, supplierId, returnType, reason, returnCategory,
      debitNoteNo, deductAmount, notes, items } = body

    if (!purchaseId || !supplierId) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const returnNo = await generateSequenceNo('PURCHASE_RETURN')

    const record = await prisma.purchaseReturn.create({
      data: {
        returnNo,
        purchaseId,
        supplierId,
        returnType: returnType ?? 'RETURN',
        reason,
        returnCategory,
        debitNoteNo,
        deductAmount: deductAmount ? Number(deductAmount) : null,
        deductStatus: deductAmount ? 'PENDING' : null,
        notes,
        createdById: session.user.id,
        items: {
          create: (items ?? []).map((item: { productId: string; quantity: number; unitCost?: number; batchNo?: string; reason?: string; condition?: string; notes?: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            subtotal: (item.quantity ?? 0) * (item.unitCost ?? 0),
            batchNo: item.batchNo,
            reason: item.reason,
            condition: item.condition,
            notes: item.notes,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        purchase: { select: { id: true, poNo: true } },
        items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'purchase-returns',
      action: 'CREATE',
      entityType: 'PurchaseReturn',
      entityId: record.id,
      entityLabel: returnNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'purchase-returns.POST')
  }
}
