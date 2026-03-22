import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status')      ?? ''
  const assignedTo  = searchParams.get('assignedTo')  ?? ''
  const taskType    = searchParams.get('taskType')     ?? ''
  const priority    = searchParams.get('priority')     ?? ''
  const myTasks     = searchParams.get('my') === 'true'
  const dateFrom    = searchParams.get('dateFrom')     ?? ''
  const dateTo      = searchParams.get('dateTo')       ?? ''

  const tasks = await prisma.salesTask.findMany({
    where: {
      ...(myTasks      && { assignedToId: session.user.id }),
      ...(assignedTo   && { assignedToId: assignedTo }),
      ...(status       && { status: status as never }),
      ...(taskType     && { taskType: taskType as never }),
      ...(priority     && { priority: priority as never }),
      ...(dateFrom     && { dueDate: { gte: new Date(dateFrom) } }),
      ...(dateTo       && { dueDate: { lte: new Date(dateTo + 'T23:59:59') } }),
    },
    include: {
      customer:   { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy:  { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.title) return NextResponse.json({ error: '請填寫任務標題' }, { status: 400 })

  const task = await prisma.salesTask.create({
    data: {
      title:        body.title,
      description:  body.description  || null,
      taskType:     body.taskType     ?? 'OTHER',
      priority:     body.priority     ?? 'MEDIUM',
      status:       'PENDING',
      dueDate:      body.dueDate      ? new Date(body.dueDate)    : null,
      customerId:   body.customerId   || null,
      assignedToId: body.assignedToId ?? session.user.id,
      createdById:  session.user.id,
      notes:        body.notes        || null,
    },
    include: {
      customer:   { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(task, { status: 201 })
}
