import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCustomer, buildScopeContext } from '@/lib/scope'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      salesRep: { select: { id: true, name: true } },
      visitRecords: {
        include: { visitedBy: { select: { id: true, name: true } } },
        orderBy: { visitDate: 'desc' },
        take: 30,
      },
      callRecords: {
        include: { calledBy: { select: { id: true, name: true } } },
        orderBy: { callDate: 'desc' },
        take: 30,
      },
      sampleRecords: {
        include: { sentBy: { select: { id: true, name: true } } },
        orderBy: { sentDate: 'desc' },
        take: 20,
      },
      complaintRecords: {
        include: {
          reportedBy:         { select: { id: true, name: true } },
          assignedSupervisor: { select: { id: true, name: true } },
          _count:             { select: { logs: true } },
          logs: {
            orderBy: { logDate: 'desc' as const },
            take: 3,
            include: { loggedBy: { select: { id: true, name: true } } },
          },
        },
        orderBy: { complaintDate: 'desc' },
        take: 20,
      },
      quotations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, quotationNo: true, status: true, totalAmount: true, createdAt: true, validUntil: true },
      },
      salesOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, orderNo: true, status: true, totalAmount: true, createdAt: true },
      },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      _count: { select: { visitRecords: true, callRecords: true, salesOrders: true, sampleRecords: true, complaintRecords: true, quotations: true } },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Data scope check: SALES/CS can only view their assigned customers
  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessCustomer(ctx, customer)) {
    return NextResponse.json({ error: '無權限查看此客戶' }, { status: 403 })
  }

  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // IDOR check: verify user can access this customer
  const existing = await prisma.customer.findUnique({ where: { id }, select: { salesRepId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ctx = buildScopeContext(session as { user: { id: string; role: string } })
  if (!canAccessCustomer(ctx, existing)) {
    return NextResponse.json({ error: '無權限修改此客戶' }, { status: 403 })
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
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
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      // new fields
      isCorporateFoundation:   body.isCorporateFoundation ?? false,
      corporateFoundationName: body.isCorporateFoundation ? (body.corporateFoundationName || null) : null,
      branchName:              body.branchName    || null,
      orgLevel:                body.orgLevel      || null,
      bedCount:                body.bedCount      ? Number(body.bedCount) : null,
      // key account fields
      isKeyAccount:       body.isKeyAccount       !== undefined ? Boolean(body.isKeyAccount) : undefined,
      keyAccountMgrId:    body.keyAccountMgrId    !== undefined ? (body.keyAccountMgrId || null) : undefined,
      visitFrequencyDays: body.visitFrequencyDays !== undefined ? (body.visitFrequencyDays ? Number(body.visitFrequencyDays) : null) : undefined,
      relationshipScore:  body.relationshipScore  !== undefined ? (body.relationshipScore ? Number(body.relationshipScore) : null) : undefined,
      keyAccountNote:     body.keyAccountNote     !== undefined ? (body.keyAccountNote || null) : undefined,
      keyAccountSince:    body.keyAccountSince    !== undefined ? (body.keyAccountSince ? new Date(body.keyAccountSince) : null) : undefined,
    },
    include: { salesRep: { select: { id: true, name: true } } },
  })

  return NextResponse.json(customer)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  const canDelete = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)
  if (!canDelete) return NextResponse.json({ error: '無權限執行此操作' }, { status: 403 })

  const { id } = await params
  await prisma.customer.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
