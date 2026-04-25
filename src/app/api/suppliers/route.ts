import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search   = searchParams.get('search')   ?? ''
    const showAll  = searchParams.get('showAll')  === 'true'

    const suppliers = await prisma.supplier.findMany({
      where: {
        ...(!showAll && { isActive: true }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    return handleApiError(error, 'suppliers.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: '請填寫供應商名稱' }, { status: 400 })

    const count = await prisma.supplier.count()
    const code  = body.code || `SUP${String(count + 1).padStart(4, '0')}`

    const existing = await prisma.supplier.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '供應商代碼已存在' }, { status: 400 })

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name:             body.name,
        contactPerson:    body.contactPerson    || null,
        phone:            body.phone            || null,
        email:            body.email            || null,
        address:          body.address          || null,
        taxId:            body.taxId            || null,
        paymentTerms:     body.paymentTerms     || null,
        leadTimeDays:     body.leadTimeDays     ? Number(body.leadTimeDays) : null,
        supplyCategories: body.supplyCategories || null,
        supplyItems:      body.supplyItems      || null,
        notes:            body.notes            || null,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: (session.user as { role?: string }).role ?? '',
      module: 'suppliers',
      action: 'CREATE',
      entityType: 'Supplier',
      entityId: supplier.id,
      entityLabel: `${supplier.code} ${supplier.name}`,
    }).catch(() => {})

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'suppliers.create')
  }
}
