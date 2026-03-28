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
    const contractType = searchParams.get('contractType') || ''
    const expiringSoon = searchParams.get('expiringSoon') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const now = new Date()
    const alertDate = new Date()
    alertDate.setDate(alertDate.getDate() + 30)

    const where = {
      ...(search && {
        OR: [
          { contractNo: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(contractType && { contractType }),
      ...(expiringSoon && {
        status: 'ACTIVE',
        effectiveTo: { gte: now, lte: alertDate },
      }),
    }

    const [total, data] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          schedules: { select: { id: true, dueDate: true, amount: true, isPaid: true } },
        },
        orderBy: { effectiveTo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'contracts.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      title, contractType, customerId, supplierId,
      signedAt, effectiveFrom, effectiveTo,
      totalValue, currency, paymentTerms,
      autoRenew, reminderDays, notes,
      schedules,
    } = body

    if (!title || !contractType || !effectiveFrom || !effectiveTo) {
      return NextResponse.json({ error: '請填寫標題、類型及有效期間' }, { status: 400 })
    }

    const contractNo = await generateSequenceNo('CONTRACT')

    const record = await prisma.contract.create({
      data: {
        contractNo,
        title,
        contractType,
        customerId: customerId || null,
        supplierId: supplierId || null,
        signedAt: signedAt ? new Date(signedAt) : null,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: new Date(effectiveTo),
        totalValue: totalValue ?? null,
        currency: currency || 'TWD',
        paymentTerms: paymentTerms || null,
        autoRenew: autoRenew ?? false,
        reminderDays: reminderDays ?? 30,
        notes: notes || null,
        createdById: session.user.id,
        status: 'ACTIVE',
        schedules: schedules?.length
          ? {
              create: schedules.map((s: { dueDate: string; amount: number; description?: string }) => ({
                dueDate: new Date(s.dueDate),
                amount: s.amount,
                description: s.description || null,
              })),
            }
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        schedules: true,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'contracts',
      action: 'CREATE',
      entityType: 'Contract',
      entityId: record.id,
      entityLabel: contractNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'contracts.POST')
  }
}
