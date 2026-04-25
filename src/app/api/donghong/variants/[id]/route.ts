import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { CountryOrigin, OriginCode } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        barcodes:      true,
        costSnapshots: { orderBy: { effectiveDate: 'desc' }, take: 5 },
        masterProduct: { select: { id: true, sku: true, name: true } },
        supplier:      { select: { id: true, name: true } },
        quotationItems: {
          include: { quotation: { select: { id: true, quotationNumber: true, status: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(variant)
  } catch (error) {
    return handleApiError(error, 'donghong.variants.get')
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      originCode?:    OriginCode
      countryOrigin?: CountryOrigin
      supplierId?:    string | null
      hsCode?:        string | null
      productImage?:  string | null
      packageImage?:  string | null
      defaultSpecLock?: unknown
      isActive?:      boolean
    }

    const before = await prisma.productVariant.findUnique({
      where: { id },
      select: { variantSku: true, isActive: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const variant = await prisma.productVariant.update({
      where: { id },
      data: {
        ...(body.originCode    !== undefined && { originCode:    body.originCode }),
        ...(body.countryOrigin !== undefined && { countryOrigin: body.countryOrigin }),
        ...(body.supplierId    !== undefined && { supplierId:    body.supplierId }),
        ...(body.hsCode        !== undefined && { hsCode:        body.hsCode }),
        ...(body.productImage  !== undefined && { productImage:  body.productImage }),
        ...(body.packageImage  !== undefined && { packageImage:  body.packageImage }),
        ...(body.defaultSpecLock !== undefined && { defaultSpecLock: body.defaultSpecLock as object }),
        ...(body.isActive      !== undefined && { isActive:      body.isActive }),
      },
    })

    logAudit({
      userId:    session.user.id,
      userName:  session.user.name ?? '',
      userRole:  session.user.role as string,
      module:    'donghong',
      action:    'UPDATE',
      entityType: 'ProductVariant',
      entityId:   id,
      entityLabel: before.variantSku,
      changes:   { isActive: { before: before.isActive, after: variant.isActive } },
    }).catch(() => {})

    return NextResponse.json(variant)
  } catch (error) {
    return handleApiError(error, 'donghong.variants.update')
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      select: { variantSku: true, isActive: true },
    })
    if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 檢查是否被活躍 PO 引用
    const activePOCount = await prisma.purchaseOrderItem.count({
      where: {
        variantId: id,
        order: {
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
      },
    })
    if (activePOCount > 0) {
      return NextResponse.json(
        { error: `此變體被 ${activePOCount} 張活躍 PO 使用，無法停用` },
        { status: 409 }
      )
    }

    await prisma.productVariant.update({ where: { id }, data: { isActive: false } })

    logAudit({
      userId:    session.user.id,
      userName:  session.user.name ?? '',
      userRole:  session.user.role as string,
      module:    'donghong',
      action:    'DEACTIVATE',
      entityType: 'ProductVariant',
      entityId:   id,
      entityLabel: variant.variantSku,
      changes:   { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'donghong.variants.delete')
  }
}
