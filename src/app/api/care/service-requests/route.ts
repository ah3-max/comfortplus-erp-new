import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status      = searchParams.get('status')     ?? ''
    const urgency     = searchParams.get('urgency')    ?? ''
    const customerId  = searchParams.get('customerId') ?? ''
    const assignedTo  = searchParams.get('assignedTo') ?? ''

    const requests = await prisma.serviceRequest.findMany({
      where: {
        ...(status     && { status: status as never }),
        ...(urgency    && { urgency: urgency as never }),
        ...(customerId && { customerId }),
        ...(assignedTo && { assignedToId: assignedTo }),
      },
      include: {
        customer:     { select: { id: true, name: true, code: true } },
        assignedTo:   { select: { id: true, name: true } },
        careSchedule: { select: { id: true, scheduleNo: true, scheduleDate: true } },
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(requests)
  } catch (error) {
    return handleApiError(error, 'serviceRequests.list')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.customerId || !body.description) {
      return NextResponse.json({ error: '請填寫客戶與問題描述' }, { status: 400 })
    }

    const request = await prisma.serviceRequest.create({
      data: {
        customerId:    body.customerId,
        requestType:   body.requestType   ?? 'OTHER',
        urgency:       body.urgency       ?? 'MEDIUM',
        description:   body.description,
        assignedToId:  body.assignedToId  || null,
        careScheduleId: body.careScheduleId || null,
      },
      include: {
        customer:   { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'serviceRequests.create')
  }
}
