import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const record = await prisma.callRecord.create({
    data: {
      customerId: id,
      calledById: session.user.id,
      callDate:   new Date(body.callDate),
      duration:   body.duration ? Number(body.duration) : null,
      purpose:    body.purpose  || null,
      content:    body.content  || null,
      result:     body.result   || null,
    },
    include: { calledBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(record, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  await prisma.callRecord.delete({ where: { id: recordId } })
  return NextResponse.json({ success: true })
}
