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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

    const where = {
      ...(search && {
        OR: [
          { projectNo: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
    }

    const [total, data] = await Promise.all([
      prisma.importProject.count({ where }),
      prisma.importProject.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          costItems: { select: { id: true, category: true, amount: true, currency: true } },
          payments: { select: { id: true, amount: true, currency: true, paymentDate: true } },
          customs: { select: { id: true, status: true } },
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
    return handleApiError(error, 'import-projects.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, supplierId, freightId, etd, eta, currency, exchangeRate, notes } = body

    if (!name) return NextResponse.json({ error: '請填寫專案名稱' }, { status: 400 })

    const projectNo = await generateSequenceNo('IMPORT_PROJECT')

    const record = await prisma.importProject.create({
      data: {
        projectNo,
        name,
        description: description || null,
        supplierId: supplierId || null,
        freightId: freightId || null,
        etd: etd ? new Date(etd) : null,
        eta: eta ? new Date(eta) : null,
        currency: currency || 'USD',
        exchangeRate: exchangeRate ?? null,
        notes: notes || null,
        createdById: session.user.id,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'import-projects',
      action: 'CREATE',
      entityType: 'ImportProject',
      entityId: record.id,
      entityLabel: projectNo,
    }).catch(() => {})

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'import-projects.POST')
  }
}
