import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const channel = await prisma.salesChannel.update({
    where: { id },
    data: {
      name:           body.name           ?? undefined,
      platform:       body.platform       ?? undefined,
      shopUrl:        body.shopUrl        ?? undefined,
      commissionRate: body.commissionRate !== undefined ? body.commissionRate : undefined,
      contactPerson:  body.contactPerson  ?? undefined,
      contactPhone:   body.contactPhone   ?? undefined,
      notes:          body.notes          ?? undefined,
      isActive:       body.isActive       ?? undefined,
    },
  })

  return NextResponse.json(channel)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.salesChannel.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
