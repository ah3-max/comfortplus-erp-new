import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const record = await prisma.sampleRecord.create({
      data: {
        customerId:    id,
        sentById:      session.user.id,
        sentDate:      new Date(body.sentDate),
        items:         body.items,
        trackingNo:    body.trackingNo    || null,
        recipient:     body.recipient     || null,
        followUpDate:  body.followUpDate  ? new Date(body.followUpDate) : null,
        followUpResult: body.followUpResult || null,
        notes:         body.notes         || null,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'customers.samples.create')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const recordId = searchParams.get('recordId')
    if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

    const body = await req.json()
    await params // consume params

    const record = await prisma.sampleRecord.update({
      where: { id: recordId },
      data: {
        followUpDate:   body.followUpDate   ? new Date(body.followUpDate)  : null,
        followUpResult: body.followUpResult || null,
        trackingNo:     body.trackingNo     || null,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(record)
  } catch (error) {
    return handleApiError(error, 'customers.samples.update')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const recordId = searchParams.get('recordId')
    if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

    await params // consume params
    await prisma.sampleRecord.delete({ where: { id: recordId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'customers.samples.delete')
  }
}
