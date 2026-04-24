import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { validateEan13 } from '@/lib/validators/ean13'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const variant = await prisma.productVariant.findUnique({ where: { id }, select: { id: true } })
    if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

    const body = await req.json() as {
      barcodeEan13:    string
      barcodeType?:    string
      quantityPerUnit?: number
      notes?:          string
    }

    if (!body.barcodeEan13) {
      return NextResponse.json({ error: 'barcodeEan13 為必填' }, { status: 400 })
    }
    if (!validateEan13(body.barcodeEan13)) {
      return NextResponse.json({ error: 'EAN-13 校驗碼錯誤' }, { status: 400 })
    }

    const barcode = await prisma.variantBarcode.create({
      data: {
        variantId:       id,
        barcodeEan13:    body.barcodeEan13,
        barcodeType:     body.barcodeType    ?? 'SINGLE',
        quantityPerUnit: body.quantityPerUnit ?? 1,
        notes:           body.notes          ?? null,
      },
    })

    return NextResponse.json(barcode, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'donghong.variants.barcodes.create')
  }
}
