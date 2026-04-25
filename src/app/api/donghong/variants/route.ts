import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { validateEan13 } from '@/lib/validators/ean13'
import { BusinessUnit, CountryOrigin, OriginCode } from '@prisma/client'

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'GM']

function buFilter(role: string): BusinessUnit[] | undefined {
  if (FULL_ACCESS_ROLES.includes(role)) return undefined
  return ['DONGHONG', 'SHARED']
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const masterSku    = sp.get('masterSku')    ?? undefined
    const supplierId   = sp.get('supplierId')   ?? undefined
    const countryOrigin = sp.get('countryOrigin') as CountryOrigin | null
    const isActiveRaw  = sp.get('isActive')
    const page         = Math.max(1, parseInt(sp.get('page')     ?? '1',  10))
    const pageSize     = Math.min(100, parseInt(sp.get('pageSize') ?? '20', 10))

    const isActive = isActiveRaw === null ? true : isActiveRaw === 'true'

    const allowedBUs = buFilter(session.user.role as string)

    const where = {
      ...(allowedBUs ? { businessUnit: { in: allowedBUs } } : {}),
      ...(masterSku    && { masterSku }),
      ...(supplierId   && { supplierId }),
      ...(countryOrigin && { countryOrigin }),
      isActive,
    }

    const [total, data] = await prisma.$transaction([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        include: {
          barcodes:     true,
          masterProduct: { select: { id: true, sku: true, name: true } },
          supplier:      { select: { id: true, name: true } },
        },
        orderBy: [{ masterSku: 'asc' }, { originCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'donghong.variants.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      masterSku:     string
      originCode:    OriginCode
      countryOrigin: CountryOrigin
      supplierId?:   string
      hsCode?:       string
      productImage?: string
      packageImage?: string
      defaultSpecLock?: unknown
      businessUnit?: BusinessUnit
      barcode?:      string
      barcodeType?:  string
      quantityPerUnit?: number
    }

    if (!body.masterSku || !body.originCode || !body.countryOrigin) {
      return NextResponse.json({ error: 'masterSku / originCode / countryOrigin 為必填' }, { status: 400 })
    }

    const variantSku = `${body.masterSku}-${body.originCode}`

    const existing = await prisma.productVariant.findUnique({ where: { variantSku } })
    if (existing) {
      return NextResponse.json({ error: `variantSku ${variantSku} 已存在` }, { status: 409 })
    }

    if (body.barcode && !validateEan13(body.barcode)) {
      return NextResponse.json({ error: 'EAN-13 校驗碼錯誤' }, { status: 400 })
    }

    const variant = await prisma.productVariant.create({
      data: {
        masterSku:      body.masterSku,
        originCode:     body.originCode,
        variantSku,
        countryOrigin:  body.countryOrigin,
        hsCode:         body.hsCode         ?? null,
        productImage:   body.productImage   ?? null,
        packageImage:   body.packageImage   ?? null,
        defaultSpecLock: body.defaultSpecLock ? (body.defaultSpecLock as object) : undefined,
        supplierId:     body.supplierId     ?? null,
        businessUnit:   body.businessUnit   ?? 'DONGHONG',
        ...(body.barcode && {
          barcodes: {
            create: {
              barcodeEan13:    body.barcode,
              barcodeType:     body.barcodeType    ?? 'SINGLE',
              quantityPerUnit: body.quantityPerUnit ?? 1,
            },
          },
        }),
      },
      include: { barcodes: true },
    })

    logAudit({
      userId:    session.user.id,
      userName:  session.user.name ?? '',
      userRole:  session.user.role as string,
      module:    'donghong',
      action:    'CREATE',
      entityType: 'ProductVariant',
      entityId:   variant.id,
      entityLabel: variantSku,
      changes:   {},
    }).catch(() => {})

    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'donghong.variants.create')
  }
}
