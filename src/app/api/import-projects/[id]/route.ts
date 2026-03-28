import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await prisma.importProject.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      freight: { select: { id: true, freightNo: true, status: true } },
      createdBy: { select: { id: true, name: true } },
      costItems: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { paymentDate: 'asc' } },
      customs: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'FINANCE'].includes(role)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const current = await prisma.importProject.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Add cost item
    if (body.action === 'ADD_COST') {
      const { category, description, currency, amount, amountTWD, invoiceNo, invoiceDate, supplierId, notes } = body
      if (!category || !description || !amount) {
        return NextResponse.json({ error: '請填寫費用類別、說明及金額' }, { status: 400 })
      }
      const item = await prisma.importCostItem.create({
        data: {
          projectId: id,
          category,
          description,
          currency: currency || 'USD',
          amount,
          amountTWD: amountTWD ?? null,
          invoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          supplierId: supplierId || null,
          notes: notes || null,
        },
      })
      // Recalculate total
      const items = await prisma.importCostItem.findMany({ where: { projectId: id } })
      const total = items.reduce((s, i) => s + Number(i.amountTWD ?? i.amount), 0)
      await prisma.importProject.update({ where: { id }, data: { totalCost: total } })
      return NextResponse.json(item, { status: 201 })
    }

    // Add payment
    if (body.action === 'ADD_PAYMENT') {
      const { paymentType, currency, amount, amountTWD, exchangeRate, paymentDate, remittanceRef, notes } = body
      if (!paymentType || !amount || !paymentDate) {
        return NextResponse.json({ error: '請填寫付款類型、金額及日期' }, { status: 400 })
      }
      const payment = await prisma.importPayment.create({
        data: {
          projectId: id,
          paymentType,
          currency: currency || 'USD',
          amount,
          amountTWD: amountTWD ?? null,
          exchangeRate: exchangeRate ?? null,
          paymentDate: new Date(paymentDate),
          remittanceRef: remittanceRef || null,
          notes: notes || null,
        },
      })
      return NextResponse.json(payment, { status: 201 })
    }

    // Add/update customs record
    if (body.action === 'SET_CUSTOMS') {
      const { declarationNo, declaredAt, customsValue, dutyRate, dutyAmount, vatAmount, status: csStatus, clearedAt, notes } = body
      const existing = await prisma.importCustoms.findFirst({ where: { projectId: id } })
      const data = {
        projectId: id,
        declarationNo: declarationNo || null,
        declaredAt: declaredAt ? new Date(declaredAt) : null,
        customsValue: customsValue ?? null,
        dutyRate: dutyRate ?? null,
        dutyAmount: dutyAmount ?? null,
        vatAmount: vatAmount ?? null,
        status: csStatus || 'PENDING',
        clearedAt: clearedAt ? new Date(clearedAt) : null,
        notes: notes || null,
      }
      const customs = existing
        ? await prisma.importCustoms.update({ where: { id: existing.id }, data })
        : await prisma.importCustoms.create({ data })
      return NextResponse.json(customs)
    }

    // Update project status or fields
    const updated = await prisma.importProject.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        status: body.status ?? undefined,
        etd: body.etd ? new Date(body.etd) : undefined,
        eta: body.eta ? new Date(body.eta) : undefined,
        actualArrival: body.actualArrival ? new Date(body.actualArrival) : undefined,
        currency: body.currency ?? undefined,
        exchangeRate: body.exchangeRate ?? undefined,
        notes: body.notes ?? undefined,
      },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'import-projects',
      action: 'UPDATE',
      entityType: 'ImportProject',
      entityId: id,
      entityLabel: current.projectNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'import-projects.PUT')
  }
}
