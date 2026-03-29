import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // IDOR check: only creator, assignee, or manager can update a task
  const existing = await prisma.salesTask.findUnique({ where: { id }, select: { createdById: true, assignedToId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role ?? ''
  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)
  const isOwner = existing.createdById === session.user.id || existing.assignedToId === session.user.id
  if (!isManager && !isOwner) {
    return NextResponse.json({ error: '無權限修改此任務' }, { status: 403 })
  }

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
  const existing = await prisma.salesTask.findUnique({ where: { id }, select: { createdById: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role ?? ''
  const isManager = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER'].includes(role)
  if (!isManager && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: '無權限刪除此任務' }, { status: 403 })
  }
  await prisma.salesTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
