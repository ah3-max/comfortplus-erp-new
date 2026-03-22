import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const completedAt = body.status === 'DONE' ? new Date() : (body.status === 'CANCELLED' ? undefined : null)

  const task = await prisma.salesTask.update({
    where: { id },
    data: {
      title:        body.title        ?? undefined,
      description:  body.description  ?? undefined,
      taskType:     body.taskType     ?? undefined,
      priority:     body.priority     ?? undefined,
      status:       body.status       ?? undefined,
      dueDate:      body.dueDate      ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
      customerId:   body.customerId   !== undefined ? (body.customerId || null) : undefined,
      assignedToId: body.assignedToId ?? undefined,
      notes:        body.notes        ?? undefined,
      ...(completedAt !== undefined && { completedAt }),
    },
    include: {
      customer:   { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(task)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.salesTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
