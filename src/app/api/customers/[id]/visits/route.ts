import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const record = await prisma.visitRecord.create({
    data: {
      customerId:   id,
      visitedById:  session.user.id,
      visitDate:    new Date(body.visitDate),
      purpose:      body.purpose      || null,
      content:      body.content      || null,
      result:        body.result       || null,
      nextAction:   body.nextAction   || null,
      nextVisitDate: body.nextVisitDate ? new Date(body.nextVisitDate) : null,
    },
    include: { visitedBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(record, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  await prisma.visitRecord.delete({ where: { id: recordId } })
  return NextResponse.json({ success: true })
}
