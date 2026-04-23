import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCustomer, buildScopeContext } from '@/lib/scope'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
          select: { id: true, orderNo: true, status: true, totalAmount: true, paidAmount: true, createdAt: true },
        },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        tourAutoAssignee: { select: { id: true, name: true } },
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
  } catch (error) {
    return handleApiError(error, 'customers.get')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    // IDOR check: verify user can access this customer
    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { salesRepId: true, name: true, code: true, creditLimit: true, isActive: true, taxId: true },
    })
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
        // tour auto-schedule
        tourAutoSchedule:   body.tourAutoSchedule   !== undefined ? Boolean(body.tourAutoSchedule) : undefined,
        tourAutoAssigneeId: body.tourAutoAssigneeId !== undefined ? (body.tourAutoAssigneeId || null) : undefined,
      },
      include: { salesRep: { select: { id: true, name: true } } },
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (existing.name !== customer.name) changes.name = { before: existing.name, after: customer.name }
    if (existing.isActive !== customer.isActive) changes.isActive = { before: existing.isActive, after: customer.isActive }
    if (existing.taxId !== customer.taxId) changes.taxId = { before: existing.taxId, after: customer.taxId }
    if (Number(existing.creditLimit ?? 0) !== Number(customer.creditLimit ?? 0)) {
      changes.creditLimit = { before: existing.creditLimit, after: customer.creditLimit }
    }
    if (existing.salesRepId !== customer.salesRepId) {
      changes.salesRepId = { before: existing.salesRepId, after: customer.salesRepId }
    }

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'customers',
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: id,
      entityLabel: `${customer.code} ${customer.name}`,
      changes,
    }).catch(() => {})

    return NextResponse.json(customer)
  } catch (error) {
    return handleApiError(error, 'customers.update')
  }
}

// PATCH — quick partial update (grade, devStatus, salesRepId, isFollowUp, nextFollowUpDate)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.customer.findUnique({ where: { id }, select: { salesRepId: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const ctx = buildScopeContext(session as { user: { id: string; role: string } })
    if (!canAccessCustomer(ctx, existing)) {
      return NextResponse.json({ error: '無權限修改此客戶' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.grade      !== undefined) updateData.grade      = body.grade || null
    if (body.devStatus  !== undefined) updateData.devStatus  = body.devStatus
    if (body.salesRepId !== undefined) updateData.salesRepId = body.salesRepId || null
    if (body.isFollowUp !== undefined) updateData.isFollowUp = Boolean(body.isFollowUp)
    if (body.nextFollowUpDate !== undefined) updateData.nextFollowUpDate = body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null
    if (body.notes      !== undefined) updateData.notes      = body.notes || null
    if (body.tourAutoSchedule   !== undefined) updateData.tourAutoSchedule   = Boolean(body.tourAutoSchedule)
    if (body.tourAutoAssigneeId !== undefined) updateData.tourAutoAssigneeId = body.tourAutoAssigneeId || null

    const customer = await prisma.customer.update({ where: { id }, data: updateData })
    return NextResponse.json(customer)
  } catch (error) {
    return handleApiError(error, 'customers.patch')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role?: string }).role ?? ''
    const canDelete = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)
    if (!canDelete) return NextResponse.json({ error: '無權限執行此操作' }, { status: 403 })

    const { id } = await params
    const target = await prisma.customer.findUnique({ where: { id }, select: { code: true, name: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.customer.update({ where: { id }, data: { isActive: false } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'customers',
      action: 'DEACTIVATE',
      entityType: 'Customer',
      entityId: id,
      entityLabel: `${target.code} ${target.name}`,
      changes: { isActive: { before: true, after: false } },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'customers.delete')
  }
}
