import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brands = await prisma.retailBrand.findMany({
    include: { _count: { select: { outlets: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(brands)
  } catch (error) {
    return handleApiError(error, 'retailBrands.get')
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name || !body.code) {
    return NextResponse.json({ error: '請填寫品牌名稱與代碼' }, { status: 400 })
  }

  const exists = await prisma.retailBrand.findUnique({ where: { code: body.code.toUpperCase() } })
  if (exists) return NextResponse.json({ error: '品牌代碼已存在' }, { status: 400 })

  const brand = await prisma.retailBrand.create({
    data: {
      code:             body.code.toUpperCase(),
      name:             body.name,
      brandType:        body.brandType        || 'OTHER',
      logoUrl:          body.logoUrl          || null,
      website:          body.website          || null,
      hqPhone:          body.hqPhone          || null,
      hqContact:        body.hqContact        || null,
      buyerName:        body.buyerName        || null,
      buyerTitle:       body.buyerTitle       || null,
      buyerDept:        body.buyerDept        || null,
      buyerPhone:       body.buyerPhone       || null,
      buyerEmail:       body.buyerEmail       || null,
      buyerLine:        body.buyerLine        || null,
      purchaseMode:     body.purchaseMode     || null,
      paymentTerms:     body.paymentTerms     || null,
      creditDays:       body.creditDays       ? Number(body.creditDays)       : null,
      deliveryLeadDays: body.deliveryLeadDays ? Number(body.deliveryLeadDays) : null,
      minOrderQty:      body.minOrderQty      ? Number(body.minOrderQty)      : null,
      minOrderNote:     body.minOrderNote     || null,
      discountNote:     body.discountNote     || null,
      listingFee:       body.listingFee       ? Number(body.listingFee)       : null,
      annualFee:        body.annualFee        ? Number(body.annualFee)        : null,
      contractExpiry:   body.contractExpiry   ? new Date(body.contractExpiry) : null,
      contractNote:     body.contractNote     || null,
      notes:            body.notes            || null,
    },
  })
  return NextResponse.json(brand, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'retailBrands.post')
  }
}

export async function PUT(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: '缺少品牌ID' }, { status: 400 })

  const brand = await prisma.retailBrand.update({
    where: { id: body.id },
    data: {
      name:             body.name             ?? undefined,
      brandType:        body.brandType        ?? undefined,
      logoUrl:          body.logoUrl          !== undefined ? (body.logoUrl || null)  : undefined,
      website:          body.website          !== undefined ? (body.website || null)  : undefined,
      hqPhone:          body.hqPhone          !== undefined ? (body.hqPhone || null)  : undefined,
      hqContact:        body.hqContact        !== undefined ? (body.hqContact || null): undefined,
      buyerName:        body.buyerName        !== undefined ? (body.buyerName || null)        : undefined,
      buyerTitle:       body.buyerTitle       !== undefined ? (body.buyerTitle || null)       : undefined,
      buyerDept:        body.buyerDept        !== undefined ? (body.buyerDept || null)        : undefined,
      buyerPhone:       body.buyerPhone       !== undefined ? (body.buyerPhone || null)       : undefined,
      buyerEmail:       body.buyerEmail       !== undefined ? (body.buyerEmail || null)       : undefined,
      buyerLine:        body.buyerLine        !== undefined ? (body.buyerLine || null)        : undefined,
      purchaseMode:     body.purchaseMode     !== undefined ? (body.purchaseMode || null)     : undefined,
      paymentTerms:     body.paymentTerms     !== undefined ? (body.paymentTerms || null)     : undefined,
      creditDays:       body.creditDays       !== undefined ? (body.creditDays ? Number(body.creditDays) : null)             : undefined,
      deliveryLeadDays: body.deliveryLeadDays !== undefined ? (body.deliveryLeadDays ? Number(body.deliveryLeadDays) : null) : undefined,
      minOrderQty:      body.minOrderQty      !== undefined ? (body.minOrderQty ? Number(body.minOrderQty) : null)           : undefined,
      minOrderNote:     body.minOrderNote     !== undefined ? (body.minOrderNote || null)     : undefined,
      discountNote:     body.discountNote     !== undefined ? (body.discountNote || null)     : undefined,
      listingFee:       body.listingFee       !== undefined ? (body.listingFee ? Number(body.listingFee) : null)             : undefined,
      annualFee:        body.annualFee        !== undefined ? (body.annualFee ? Number(body.annualFee) : null)               : undefined,
      contractExpiry:   body.contractExpiry   !== undefined ? (body.contractExpiry ? new Date(body.contractExpiry) : null)  : undefined,
      contractNote:     body.contractNote     !== undefined ? (body.contractNote || null)     : undefined,
      notes:            body.notes            !== undefined ? (body.notes || null)            : undefined,
      isActive:         body.isActive         !== undefined ? body.isActive                  : undefined,
    },
  })
  return NextResponse.json(brand)
  } catch (error) {
    return handleApiError(error, 'retailBrands.put')
  }
}
