import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const INCIDENT_INCLUDE = {
  customer:     { select: { id: true, name: true, code: true } },
  reportedBy:   { select: { id: true, name: true } },
  assignedOwner: { select: { id: true, name: true } },
  product:      { select: { id: true, name: true, sku: true } },
  _count:       { select: { attachments: true, visitLogs: true, audioRecords: true, trainingLogs: true, actionItems: true } },
  actionItems:  { where: { status: { in: ['OPEN', 'IN_PROGRESS'] as never[] } }, select: { id: true, actionTitle: true, status: true, dueDate: true } },
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const status     = searchParams.get('status')
  const severity   = searchParams.get('severity')
  const isKB       = searchParams.get('knowledgeBase') === 'true'
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit      = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = customerId
  if (status)     where.status     = status
  if (severity)   where.severity   = severity
  if (isKB)       where.isKnowledgeBase = true

  const [total, items] = await Promise.all([
    prisma.careIncident.count({ where: where as never }),
    prisma.careIncident.findMany({
      where:   where as never,
      include: INCIDENT_INCLUDE,
      orderBy: [{ severity: 'desc' }, { incidentDate: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ total, page, limit, items })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const countToday = await prisma.careIncident.count({
    where: { incidentNo: { startsWith: `CI-${dateStr}` } },
  })
  const incidentNo = `CI-${dateStr}-${String(countToday + 1).padStart(3, '0')}`

  const incident = await prisma.careIncident.create({
    data: {
      incidentNo,
      customerId:           body.customerId,
      orderId:              body.orderId              || null,
      productId:            body.productId            || null,
      batchNo:              body.batchNo              || null,
      incidentType:         body.incidentType,
      incidentSource:       body.incidentSource,
      incidentDate:         new Date(body.incidentDate),
      reportedById:         session.user.id,
      contactPerson:        body.contactPerson        || null,
      assignedOwnerId:      body.assignedOwnerId      || null,
      severity:             body.severity             || 'MEDIUM',
      symptomCategory:      body.symptomCategory      || null,
      issueSummary:         body.issueSummary,
      detailedDescription:  body.detailedDescription  || null,
      suspectedCause:       body.suspectedCause       || null,
      immediateActionTaken: body.immediateActionTaken || null,
      requiresOnSiteVisit:  body.requiresOnSiteVisit  ?? false,
      scheduledVisitDate:   body.scheduledVisitDate ? new Date(body.scheduledVisitDate) : null,
    },
    include: INCIDENT_INCLUDE,
  })

  if (body.severity === 'CRITICAL') {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 1)
    await prisma.incidentActionItem.create({
      data: {
        incidentId:  incident.id,
        actionTitle: `【緊急】${incident.issueSummary} — 優先處理`,
        ownerUserId: body.assignedOwnerId || session.user.id,
        dueDate,
        status:      'OPEN' as never,
      },
    })
  }

  return NextResponse.json(incident, { status: 201 })
}
