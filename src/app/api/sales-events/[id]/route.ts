import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await prisma.salesEvent.findUnique({
    where: { id },
    include: {
      customer:   { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy:  { select: { id: true, name: true } },
    },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(event)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { eventType, eventDate, items, quantity, amount, assignedToId, isCompleted, notes } = body

  const updated = await prisma.salesEvent.update({
    where: { id },
    data: {
      ...(eventType    !== undefined ? { eventType }                      : {}),
      ...(eventDate    !== undefined ? { eventDate: new Date(eventDate) } : {}),
      ...(items        !== undefined ? { items }                          : {}),
      ...(quantity     !== undefined ? { quantity }                       : {}),
      ...(amount       !== undefined ? { amount }                         : {}),
      ...(assignedToId !== undefined ? { assignedToId }                   : {}),
      ...(isCompleted  !== undefined ? { isCompleted }                    : {}),
      ...(notes        !== undefined ? { notes }                          : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.salesEvent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
