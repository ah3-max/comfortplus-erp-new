import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { customerScope, buildScopeContext } from '@/lib/scope'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search      = searchParams.get('search')      ?? ''
    const type        = searchParams.get('type')        ?? ''
    const region      = searchParams.get('region')      ?? ''
    const devStatus   = searchParams.get('devStatus')   ?? ''
    const grade       = searchParams.get('grade')       ?? ''
    const salesRep    = searchParams.get('salesRep')    ?? ''
    const isKeyAccount = searchParams.get('isKeyAccount')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 50)))

    // Data scope: SALES/CS only see their assigned customers
    const scope = customerScope(buildScopeContext(session as { user: { id: string; role: string } }))

    const where = {
      isActive: true,
      ...scope,
      ...(search && {
        OR: [
          { name:          { contains: search, mode: 'insensitive' as const } },
          { code:          { contains: search, mode: 'insensitive' as const } },
          { contactPerson: { contains: search, mode: 'insensitive' as const } },
          { phone:         { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(type      && { type:      type      as never }),
      ...(region    && { region: region as never }),
      ...(devStatus && { devStatus: devStatus as never }),
      ...(grade     && { grade:     grade     as never }),
      ...(salesRep  && { salesRepId: salesRep }),
      ...(isKeyAccount === 'true' && { isKeyAccount: true }),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          salesRep:      { select: { id: true, name: true } },
          keyAccountMgr: { select: { id: true, name: true } },
          _count:   { select: { visitRecords: true, callRecords: true, salesOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      data: customers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'customers.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // ── Validation ──
    if (!body.name?.trim()) {
      return NextResponse.json({ error: '客戶名稱為必填' }, { status: 400 })
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 })
    }
    if (body.phone && !/^[\d\-+().\s]{7,20}$/.test(body.phone)) {
      return NextResponse.json({ error: '電話格式不正確' }, { status: 400 })
    }
    if (body.taxId && !/^\d{8}$/.test(body.taxId)) {
      return NextResponse.json({ error: '統一編號須為 8 位數字' }, { status: 400 })
    }

    // Duplicate name check
    if (body.name) {
      const existing = await prisma.customer.findFirst({
        where: { name: body.name, isActive: true },
        select: { id: true, code: true },
      })
      if (existing) {
        return NextResponse.json({
          error: `客戶「${body.name}」已存在（${existing.code}）`,
          duplicateId: existing.id,
        }, { status: 409 })
      }
    }

    let code = body.code
    if (!code) {
      const count = await prisma.customer.count()
      code = `C${String(count + 1).padStart(4, '0')}`
    }

    const customer = await prisma.customer.create({
      data: {
        code,
        name:          body.name,
        type:          body.type,
        contactPerson: body.contactPerson || null,
        phone:         body.phone         || null,
        lineId:        body.lineId        || null,
        email:         body.email         || null,
        address:       body.address       || null,
        region:        body.region        || null,
        taxId:         body.taxId         || null,
        paymentTerms:  body.paymentTerms  || null,
        creditLimit:   body.creditLimit   ? Number(body.creditLimit) : null,
        grade:         body.grade         || null,
        devStatus:     body.devStatus     || 'POTENTIAL',
        source:        body.source        || null,
        salesRepId:              body.salesRepId    || null,
        winRate:                 body.winRate !== undefined && body.winRate !== '' ? Number(body.winRate) : null,
        estimatedMonthlyVolume:  body.estimatedMonthlyVolume ? Number(body.estimatedMonthlyVolume) : null,
        notes:                   body.notes         || null,
        // new fields
        isCorporateFoundation:   body.isCorporateFoundation ?? false,
        corporateFoundationName: body.isCorporateFoundation ? (body.corporateFoundationName || null) : null,
        branchName:              body.branchName    || null,
        orgLevel:                body.orgLevel      || null,
        bedCount:                body.bedCount      ? Number(body.bedCount) : null,
      },
      include: { salesRep: { select: { id: true, name: true } } },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'customers.create')
  }
}
