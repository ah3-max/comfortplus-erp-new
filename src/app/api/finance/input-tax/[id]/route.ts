import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

const FINANCE_ROLES = ['SUPER_ADMIN', 'GM', 'FINANCE']

/** GET /api/finance/input-tax/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!FINANCE_ROLES.includes((session.user as { role?: string }).role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const item = await prisma.inputTaxItem.findUnique({
      where: { id },
      include: { ap: { select: { id: true, invoiceNo: true, supplierId: true } } },
    })
    if (!item) return NextResponse.json({ error: '找不到此進項憑證' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    return handleApiError(error, 'input-tax.[id].GET')
  }
}

/** PATCH /api/finance/input-tax/:id */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await prisma.inputTaxItem.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此進項憑證' }, { status: 404 })

    const body = await req.json()
    const {
      vendorName, vendorTaxId, invoiceNo, invoiceDate,
      subtotal, taxAmount, totalAmount,
      sourceType, taxPeriod, attachmentUrl, apId,
    } = body

    if (sourceType && !['CUSTOMS', 'DOMESTIC_INVOICE', 'RECEIPT'].includes(sourceType)) {
      return NextResponse.json({ error: '無效的 sourceType' }, { status: 400 })
    }
    if (taxPeriod && !/^\d{4}-\d{2}$/.test(taxPeriod)) {
      return NextResponse.json({ error: 'taxPeriod 格式應為 YYYY-MM' }, { status: 400 })
    }

    const updated = await prisma.inputTaxItem.update({
      where: { id },
      data: {
        ...(vendorName    !== undefined && { vendorName }),
        ...(vendorTaxId   !== undefined && { vendorTaxId }),
        ...(invoiceNo     !== undefined && { invoiceNo }),
        ...(invoiceDate   !== undefined && { invoiceDate: new Date(invoiceDate) }),
        ...(subtotal      !== undefined && { subtotal:    Number(subtotal) }),
        ...(taxAmount     !== undefined && { taxAmount:   Number(taxAmount) }),
        ...(totalAmount   !== undefined && { totalAmount: Number(totalAmount) }),
        ...(sourceType    !== undefined && { sourceType }),
        ...(taxPeriod     !== undefined && { taxPeriod }),
        ...(attachmentUrl !== undefined && { attachmentUrl }),
        ...(apId          !== undefined && { apId }),
      },
    })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'input-tax', action: 'UPDATE', entityType: 'InputTaxItem',
      entityId: id, entityLabel: updated.invoiceNo,
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'input-tax.[id].PATCH')
  }
}

/** DELETE /api/finance/input-tax/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!FINANCE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await prisma.inputTaxItem.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '找不到此進項憑證' }, { status: 404 })

    await prisma.inputTaxItem.delete({ where: { id } })

    logAudit({
      userId: session.user.id, userName: session.user.name ?? '', userRole: role,
      module: 'input-tax', action: 'DELETE', entityType: 'InputTaxItem',
      entityId: id, entityLabel: existing.invoiceNo,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'input-tax.[id].DELETE')
  }
}
