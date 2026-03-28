import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

// GET /api/special-prices?customerId=&productId=
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId') || undefined
    const productId = searchParams.get('productId') || undefined

    const data = await prisma.specialPrice.findMany({
      where: {
        ...(customerId && { customerId }),
        ...(productId && { productId }),
      },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, sku: true, name: true, unit: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error, 'special-prices.GET')
  }
}

// POST /api/special-prices — upsert a special price
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { customerId, productId, price, effectiveDate, expiryDate, notes } = body

    if (!customerId || !productId || price == null) {
      return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
    }

    const data = await prisma.specialPrice.upsert({
      where: { customerId_productId: { customerId, productId } },
      create: {
        customerId, productId,
        price,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
      },
      update: {
        price,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'special-prices',
      action: 'UPSERT',
      entityType: 'SpecialPrice',
      entityId: data.id,
      entityLabel: `${data.customer.name} × ${data.product.name}`,
      changes: { price: { before: '', after: String(price) } },
    }).catch(() => {})

    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error, 'special-prices.POST')
  }
}

// DELETE /api/special-prices?id=
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE', 'SALES_MANAGER'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    await prisma.specialPrice.delete({ where: { id } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'special-prices',
      action: 'DELETE',
      entityType: 'SpecialPrice',
      entityId: id,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'special-prices.DELETE')
  }
}
