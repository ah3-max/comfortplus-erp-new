import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'
import { validateEan13 } from '@/lib/validators/ean13'
import { CountryOrigin, OriginCode } from '@prisma/client'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT']

interface VariantInput {
  originCode:      OriginCode
  countryOrigin:   CountryOrigin
  supplierId?:     string
  hsCode?:         string
  barcode?:        string
  isDefaultVariant?: boolean
}

interface MasterSkuBody {
  masterSku:          string
  name:               string
  category:           string
  series?:            string
  variants:           VariantInput[]
  defaultVariantCode?: OriginCode
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!ALLOWED_ROLES.includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as MasterSkuBody

    if (!body.masterSku || !body.name || !body.category) {
      return NextResponse.json({ error: 'masterSku / name / category 為必填' }, { status: 400 })
    }
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json({ error: '至少要提供一個 variant' }, { status: 400 })
    }

    // 驗證所有 barcode
    for (const v of body.variants) {
      if (v.barcode && !validateEan13(v.barcode)) {
        return NextResponse.json(
          { error: `EAN-13 校驗碼錯誤：${v.barcode}（originCode: ${v.originCode}）` },
          { status: 400 }
        )
      }
    }

    // 預算 variantSku 清單，提前檢查衝突
    const skusToCreate = body.variants.map(v => `${body.masterSku}-${v.originCode}`)
    const conflicts = await prisma.productVariant.findMany({
      where: { variantSku: { in: skusToCreate } },
      select: { variantSku: true },
    })
    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: `以下 variantSku 已存在：${conflicts.map(c => c.variantSku).join(', ')}` },
        { status: 409 }
      )
    }

    // 也確認 masterSku 未被 Product 使用
    const existingProduct = await prisma.product.findUnique({ where: { masterSku: body.masterSku } })
    if (existingProduct) {
      return NextResponse.json({ error: `masterSku ${body.masterSku} 已存在` }, { status: 409 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. 建 Product（先不設 defaultVariantId，後面更新）
      const product = await tx.product.create({
        data: {
          sku:         body.masterSku,
          name:        body.name,
          category:    body.category,
          series:      body.series ?? null,
          isMasterSku: true,
          masterSku:   body.masterSku,
          businessUnit: 'SHARED',
          costPrice:   0,
          sellingPrice: 0,
        },
      })

      // 2. 建 N 個 ProductVariant + barcode
      const createdVariants: Array<{ id: string; variantSku: string; originCode: string }> = []
      for (const v of body.variants) {
        const variantSku = `${body.masterSku}-${v.originCode}`
        const variant = await tx.productVariant.create({
          data: {
            masterSku:      body.masterSku,
            originCode:     v.originCode,
            variantSku,
            countryOrigin:  v.countryOrigin,
            supplierId:     v.supplierId ?? null,
            hsCode:         v.hsCode     ?? null,
            masterProductId: product.id,
            businessUnit:   'DONGHONG',
            ...(v.barcode && {
              barcodes: {
                create: {
                  barcodeEan13:    v.barcode,
                  barcodeType:     'SINGLE',
                  quantityPerUnit: 1,
                },
              },
            }),
          },
        })
        createdVariants.push({ id: variant.id, variantSku, originCode: v.originCode })
      }

      // 3. 設定 defaultVariant
      let defaultVariantId: string | undefined
      if (body.defaultVariantCode) {
        const def = createdVariants.find(v => v.originCode === body.defaultVariantCode)
        if (def) defaultVariantId = def.id
      } else {
        defaultVariantId = createdVariants[0].id
      }

      if (defaultVariantId) {
        await tx.product.update({
          where: { id: product.id },
          data:  { defaultVariantId },
        })
      }

      return { product, variants: createdVariants, defaultVariantId }
    })

    logAudit({
      userId:    session.user.id,
      userName:  session.user.name ?? '',
      userRole:  session.user.role as string,
      module:    'donghong',
      action:    'CREATE',
      entityType: 'MasterSku',
      entityId:   result.product.id,
      entityLabel: body.masterSku,
      changes:   { variantCount: { before: 0, after: result.variants.length } },
    }).catch(() => {})

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'donghong.masterSkus.create')
  }
}
