import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const range = await prisma.eInvoiceNumberRange.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  if (!range) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: range })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.eInvoiceNumberRange.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Cannot modify if already used
    if (existing.currentNumber >= existing.startNumber && body.startNumber !== undefined) {
      return NextResponse.json({ error: '已有使用紀錄，不可修改起始號碼' }, { status: 400 })
    }

    const updated = await prisma.eInvoiceNumberRange.update({
      where: { id },
      data: {
        endNumber: body.endNumber !== undefined ? Number(body.endNumber) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        note: body.note !== undefined ? body.note : undefined,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'e-invoice-ranges',
      action: 'UPDATE',
      entityType: 'EInvoiceNumberRange',
      entityId: id,
      entityLabel: `${existing.prefix} ${existing.year}-${existing.period}`,
    }).catch(() => {})

    return NextResponse.json({ data: updated })
  } catch (error) {
    return handleApiError(error, 'e-invoice-ranges.PUT')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await prisma.eInvoiceNumberRange.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (existing.currentNumber >= existing.startNumber) {
      return NextResponse.json({ error: '已有使用紀錄，不可刪除' }, { status: 400 })
    }

    await prisma.eInvoiceNumberRange.delete({ where: { id } })

    logAudit({
      userId: session.user.id,
      userName: session.user.name ?? '',
      userRole: role,
      module: 'e-invoice-ranges',
      action: 'DELETE',
      entityType: 'EInvoiceNumberRange',
      entityId: id,
      entityLabel: `${existing.prefix} ${existing.year}-${existing.period}`,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'e-invoice-ranges.DELETE')
  }
}
