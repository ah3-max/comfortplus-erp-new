import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

// GET /api/products/[id]/suppliers — list all suppliers for a product
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const suppliers = await prisma.productSupplier.findMany({
    where: { productId: id },
    include: {
      supplier: { select: { id: true, code: true, name: true, country: true, leadTimeDays: true, avgDefectRate: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { status: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(suppliers)
  } catch (error) {
    return handleApiError(error, 'productSuppliers.get')
  }
}

// POST /api/products/[id]/suppliers — add a supplier to a product
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  if (!body.supplierId) return NextResponse.json({ error: '請選擇供應商' }, { status: 400 })

  // If setting as primary, clear others first
  if (body.isPrimary) {
    await prisma.productSupplier.updateMany({
      where: { productId: id },
      data: { isPrimary: false },
    })
  }

  const ps = await prisma.productSupplier.upsert({
    where: { productId_supplierId: { productId: id, supplierId: body.supplierId } },
    create: {
      productId:         id,
      supplierId:        body.supplierId,
      factorySku:        body.factorySku        || null,
      factoryProductName: body.factoryProductName || null,
      unitCost:          body.unitCost          ? Number(body.unitCost)          : null,
      currency:          body.currency          || 'USD',
      moq:               body.moq               ? Number(body.moq)               : null,
      leadTimeDays:      body.leadTimeDays       ? Number(body.leadTimeDays)      : null,
      paymentTerms:      body.paymentTerms       || null,
      deliveryTerm:      body.deliveryTerm       || null,
      originCountry:     body.originCountry      || null,
      status:            body.status             || 'ACTIVE',
      isPrimary:         !!body.isPrimary,
      qualityGrade:      body.qualityGrade       || null,
      sampleVersion:     body.sampleVersion      || null,
      sampleApprovedAt:  body.sampleApprovedAt   ? new Date(body.sampleApprovedAt) : null,
      certifications:    body.certifications     || null,
      notes:             body.notes              || null,
    },
    update: {
      factorySku:        body.factorySku         !== undefined ? (body.factorySku || null)         : undefined,
      factoryProductName: body.factoryProductName !== undefined ? (body.factoryProductName || null) : undefined,
      unitCost:          body.unitCost           !== undefined ? (body.unitCost ? Number(body.unitCost) : null)          : undefined,
      currency:          body.currency           ?? undefined,
      moq:               body.moq                !== undefined ? (body.moq ? Number(body.moq) : null)                   : undefined,
      leadTimeDays:      body.leadTimeDays        !== undefined ? (body.leadTimeDays ? Number(body.leadTimeDays) : null) : undefined,
      paymentTerms:      body.paymentTerms        !== undefined ? (body.paymentTerms || null)       : undefined,
      deliveryTerm:      body.deliveryTerm        !== undefined ? (body.deliveryTerm || null)       : undefined,
      originCountry:     body.originCountry       !== undefined ? (body.originCountry || null)      : undefined,
      status:            body.status              ?? undefined,
      isPrimary:         body.isPrimary           !== undefined ? !!body.isPrimary                  : undefined,
      qualityGrade:      body.qualityGrade        !== undefined ? (body.qualityGrade || null)       : undefined,
      sampleVersion:     body.sampleVersion       !== undefined ? (body.sampleVersion || null)      : undefined,
      sampleApprovedAt:  body.sampleApprovedAt    !== undefined ? (body.sampleApprovedAt ? new Date(body.sampleApprovedAt) : null) : undefined,
      certifications:    body.certifications      !== undefined ? (body.certifications || null)     : undefined,
      notes:             body.notes               !== undefined ? (body.notes || null)              : undefined,
    },
    include: {
      supplier: { select: { id: true, code: true, name: true, country: true } },
    },
  })

  // Sync primary supplier snapshot back to Product
  if (body.isPrimary) {
    await prisma.product.update({
      where: { id },
      data: {
        factorySku:   body.factorySku   || null,
        moq:          body.moq          ? Number(body.moq)          : undefined,
        leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : undefined,
      },
    })
  }

  return NextResponse.json(ps, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'productSuppliers.post')
  }
}

// DELETE /api/products/[id]/suppliers?supplierId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supplierId = new URL(req.url).searchParams.get('supplierId')
  if (!supplierId) return NextResponse.json({ error: '缺少 supplierId' }, { status: 400 })

  await prisma.productSupplier.delete({
    where: { productId_supplierId: { productId: id, supplierId } },
  })
  return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'productSuppliers.delete')
  }
}
