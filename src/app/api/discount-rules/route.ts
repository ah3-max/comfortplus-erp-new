import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const ruleType = searchParams.get('ruleType')
    const active = searchParams.get('active')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where: Record<string, unknown> = {}
    if (ruleType) where.ruleType = ruleType
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false

    const [data, total] = await Promise.all([
      prisma.discountRule.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { priority: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.discountRule.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return handleApiError(error, 'discount-rules.GET')
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      name, ruleType, discountType, scope, scopeValue,
      minQty, minAmount, discountValue, effectiveFrom, effectiveTo,
      isActive, priority, notes,
    } = body

    if (!name || !ruleType || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: '名稱、規則類型、折扣類型及折扣值為必填' }, { status: 400 })
    }

    const rule = await prisma.discountRule.create({
      data: {
        name,
        ruleType,
        discountType,
        scope: scope ?? 'ALL',
        scopeValue: scopeValue ?? null,
        minQty: minQty ?? null,
        minAmount: minAmount ?? null,
        discountValue: Number(discountValue),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: isActive ?? true,
        priority: priority ?? 0,
        notes: notes ?? null,
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'discount-rules', action: 'CREATE',
      entityType: 'DiscountRule', entityId: rule.id,
      entityLabel: `${rule.name} (${rule.ruleType}/${rule.discountType} ${rule.discountValue})`,
    }).catch(() => {})

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'discount-rules.POST')
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['FINANCE', 'GM', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    const existing = await prisma.discountRule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const {
      name, ruleType, discountType, scope, scopeValue,
      minQty, minAmount, discountValue, effectiveFrom, effectiveTo,
      isActive, priority, notes,
    } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (ruleType !== undefined) data.ruleType = ruleType
    if (discountType !== undefined) data.discountType = discountType
    if (scope !== undefined) data.scope = scope
    if (scopeValue !== undefined) data.scopeValue = scopeValue
    if (minQty !== undefined) data.minQty = minQty
    if (minAmount !== undefined) data.minAmount = minAmount
    if (discountValue !== undefined) data.discountValue = Number(discountValue)
    if (effectiveFrom !== undefined) data.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : null
    if (effectiveTo !== undefined) data.effectiveTo = effectiveTo ? new Date(effectiveTo) : null
    if (isActive !== undefined) data.isActive = isActive
    if (priority !== undefined) data.priority = priority
    if (notes !== undefined) data.notes = notes

    const rule = await prisma.discountRule.update({ where: { id }, data })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (Number(existing.discountValue) !== Number(rule.discountValue)) {
      changes.discountValue = { before: Number(existing.discountValue), after: Number(rule.discountValue) }
    }
    if (existing.isActive !== rule.isActive) changes.isActive = { before: existing.isActive, after: rule.isActive }

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'discount-rules', action: 'UPDATE',
      entityType: 'DiscountRule', entityId: id,
      entityLabel: `${rule.name} (${rule.ruleType}/${rule.discountType})`,
      changes,
    }).catch(() => {})

    return NextResponse.json(rule)
  } catch (error) {
    return handleApiError(error, 'discount-rules.PUT')
  }
}
