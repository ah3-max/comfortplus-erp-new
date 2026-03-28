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
    const priority = searchParams.get('priority') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { orderNo: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(priority && { priority }),
    }

    const [total, data] = await Promise.all([
      prisma.afterSalesOrder.count({ where }),
      prisma.afterSalesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          processingLogs: { select: { id: true }, take: 0 },
          consumptions: { select: { id: true, quantity: true, totalCost: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'after-sales.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { source, priority, customerId, contactName, contactPhone, description, assignedToId, scheduledAt, notes } = body

    if (!source || !description) {
      return NextResponse.json({ error: '請填寫服務類型及問題說明' }, { status: 400 })
    }

    const orderNo = await generateSequenceNo('AFTER_SALES')

    const record = await prisma.afterSalesOrder.create({
      data: {
        orderNo,
        source,
        priority: priority || 'MEDIUM',
        customerId: customerId || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        description,
        assignedToId: assignedToId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes: notes || null,
        createdById: session.user.id,
      },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'after-sales',
      action: 'CREATE',
      entityType: 'AfterSalesOrder',
      entityId: record.id,
      entityLabel: orderNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'after-sales.POST')
  }
}
