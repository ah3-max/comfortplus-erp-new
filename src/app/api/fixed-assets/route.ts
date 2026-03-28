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
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { assetNo: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { serialNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(category && { category }),
    }

    const [total, data] = await Promise.all([
      prisma.fixedAsset.count({ where }),
      prisma.fixedAsset.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          depreciations: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }], take: 1 },
        },
        orderBy: { purchaseDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'fixed-assets.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      name, category, description, location, serialNo,
      purchaseDate, purchaseAmount, salvageValue, usefulLifeYears,
      depreciationMethod, supplierId, assignedToId, notes,
    } = body

    if (!name || !category || !purchaseDate || !purchaseAmount || !usefulLifeYears) {
      return NextResponse.json({ error: '請填寫名稱、類別、購入日期、購入金額及耐用年數' }, { status: 400 })
    }

    const assetNo = await generateSequenceNo('FIXED_ASSET')

    // Pre-generate depreciation schedule (straight-line method)
    const cost = Number(purchaseAmount)
    const scrap = Number(salvageValue ?? 0)
    const years = Number(usefulLifeYears)
    const monthlyDep = (cost - scrap) / (years * 12)
    const startDate = new Date(purchaseDate)

    const depSchedule = []
    let bookValue = cost
    for (let m = 0; m < years * 12; m++) {
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + m)
      const yr = d.getFullYear()
      const mo = d.getMonth() + 1
      const depAmt = Math.min(monthlyDep, Math.max(0, bookValue - scrap))
      const closing = bookValue - depAmt
      depSchedule.push({
        periodYear: yr,
        periodMonth: mo,
        openingBookValue: bookValue,
        depreciationAmt: depAmt,
        closingBookValue: closing,
      })
      bookValue = closing
      if (bookValue <= scrap) break
    }

    const record = await prisma.fixedAsset.create({
      data: {
        assetNo,
        name,
        category,
        description: description || null,
        location: location || null,
        serialNo: serialNo || null,
        purchaseDate: new Date(purchaseDate),
        purchaseAmount,
        salvageValue: salvageValue ?? 0,
        usefulLifeYears: years,
        depreciationMethod: depreciationMethod || 'SL',
        supplierId: supplierId || null,
        assignedToId: assignedToId || null,
        notes: notes || null,
        createdById: session.user.id,
        depreciations: { create: depSchedule },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        depreciations: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }], take: 12 },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'fixed-assets',
      action: 'CREATE',
      entityType: 'FixedAsset',
      entityId: record.id,
      entityLabel: assetNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'fixed-assets.POST')
  }
}
