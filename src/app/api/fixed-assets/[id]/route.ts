import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.fixedAsset.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      depreciations: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const current = await prisma.fixedAsset.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Mark depreciation period as posted
    if (body.action === 'POST_DEPRECIATION') {
      const dep = await prisma.fixedAssetDepreciation.update({
        where: { id: body.depreciationId },
        data: { isPosted: true, postedAt: new Date() },
      })
      return NextResponse.json(dep)
    }

    // Dispose asset
    if (body.action === 'DISPOSE') {
      const updated = await prisma.fixedAsset.update({
        where: { id },
        data: {
          status: body.status ?? 'DISPOSED',
          disposedAt: body.disposedAt ? new Date(body.disposedAt) : new Date(),
          disposalAmount: body.disposalAmount ?? null,
          notes: body.notes ?? current.notes,
        },
      })
      return NextResponse.json(updated)
    }

    // Update general fields
    const updated = await prisma.fixedAsset.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        category: body.category ?? undefined,
        description: body.description !== undefined ? (body.description || null) : undefined,
        location: body.location !== undefined ? (body.location || null) : undefined,
        serialNo: body.serialNo !== undefined ? (body.serialNo || null) : undefined,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
        purchaseAmount: body.purchaseAmount != null ? body.purchaseAmount : undefined,
        salvageValue: body.salvageValue != null ? body.salvageValue : undefined,
        usefulLifeYears: body.usefulLifeYears != null ? body.usefulLifeYears : undefined,
        depreciationMethod: body.depreciationMethod ?? undefined,
        assignedToId: body.assignedToId ?? undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'fixed-assets.PUT')
  }
}
