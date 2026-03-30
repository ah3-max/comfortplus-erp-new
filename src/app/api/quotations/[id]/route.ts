import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessQuotation, buildScopeContext } from '@/lib/scope'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true, sellingPrice: true } } },
        },
      },
    })

    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Data scope check: SALES/CS can only view their own quotations
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (!canAccessQuotation(ctx, quotation)) {
      return NextResponse.json({ error: '無權限查看此報價單' }, { status: 403 })
    }

    return NextResponse.json(quotation)
  } catch (error) {
    return handleApiError(error, 'quotations.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    // 只允許更新狀態
    if (body.statusOnly) {
      const quotation = await prisma.quotation.update({
        where: { id },
        data: { status: body.status },
      })
      return NextResponse.json(quotation)
    }

    const totalAmount = body.items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number; discount: number }) =>
        sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
      0
    )

    // 刪除舊明細再重建
    await prisma.quotationItem.deleteMany({ where: { quotationId: id } })

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        customerId: body.customerId,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        totalAmount,
        notes: body.notes || null,
        items: {
          create: body.items.map((item: {
            productId: string
            quantity: number
            unitPrice: number
            discount: number
          }) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            subtotal: item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100),
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json(quotation)
  } catch (error) {
    return handleApiError(error, 'quotations.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const q = await prisma.quotation.findUnique({ where: { id } })
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (q.status !== 'DRAFT') {
      return NextResponse.json({ error: '只能刪除草稿狀態的報價單' }, { status: 400 })
    }

    await prisma.quotation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'quotations.delete')
  }
}
