import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CustomerDevStatus } from '@prisma/client'

// POST /api/customers/[id]/followup — 建立追蹤日誌（含自動觸發）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params
  const body = await req.json()

  const {
    logDate, logType, method, contactPersonId,
    content, result, customerReaction,
    nextFollowUpDate, nextAction,
    hasSample, sampleItems,
    hasQuote, hasOrder,
    opportunityId, isFollowUp,
    attachments,
  } = body

  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  // ── 1. 建立追蹤日誌 ──────────────────────────────────────
  const log = await prisma.followUpLog.create({
    data: {
      customerId,
      createdById: session.user.id,
      logDate: logDate ? new Date(logDate) : new Date(),
      logType: logType ?? 'CALL',
      method: method ?? null,
      contactPersonId: contactPersonId ?? null,
      content,
      result: result ?? null,
      customerReaction: customerReaction ?? null,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      nextAction: nextAction ?? null,
      hasSample: hasSample ?? false,
      sampleItems: sampleItems ?? null,
      hasQuote: hasQuote ?? false,
      hasOrder: hasOrder ?? false,
      opportunityId: opportunityId ?? null,
      isFollowUp: isFollowUp !== undefined ? isFollowUp : true,
      attachments: attachments ? JSON.stringify(attachments) : null,
    },
  })

  // ── 2. 自動更新 Customer 主檔（含自動判斷客戶階段）──────
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { devStatus: true },
  })

  // 客戶階段優先級（由低→高）
  const STAGE_RANK: Record<string, number> = {
    POTENTIAL: 0, CONTACTED: 1, VISITED: 2,
    NEGOTIATING: 3, TRIAL: 4, CLOSED: 5,
    STABLE_REPURCHASE: 6, DORMANT: -1, CHURNED: -1, REJECTED: -1, OTHER: 0,
  }
  const VISIT_TYPES = new Set(['FIRST_VISIT', 'SECOND_VISIT', 'THIRD_VISIT', 'DELIVERY', 'SPRING_PARTY', 'EXPO'])

  function upgradeStage(current: string, candidate: string): string {
    const currentRank = STAGE_RANK[current] ?? 0
    const candidateRank = STAGE_RANK[candidate] ?? 0
    // Only upgrade, never downgrade (unless current is dormant/churned)
    if (currentRank < 0) return candidate  // dormant/churned → always update
    return candidateRank > currentRank ? candidate : current
  }

  let newStage: CustomerDevStatus = customer?.devStatus ?? CustomerDevStatus.POTENTIAL

  // Log type determines minimum stage
  if (log.logType === 'CALL' || log.logType === 'LINE' || log.logType === 'EMAIL') {
    newStage = upgradeStage(newStage, CustomerDevStatus.CONTACTED) as CustomerDevStatus
  }
  if (VISIT_TYPES.has(log.logType)) {
    newStage = upgradeStage(newStage, CustomerDevStatus.VISITED) as CustomerDevStatus
  }
  if (hasSample) {
    newStage = upgradeStage(newStage, CustomerDevStatus.TRIAL) as CustomerDevStatus
  }
  if (hasQuote) {
    newStage = upgradeStage(newStage, CustomerDevStatus.NEGOTIATING) as CustomerDevStatus
  }
  if (hasOrder) {
    if (newStage === CustomerDevStatus.CLOSED || newStage === CustomerDevStatus.STABLE_REPURCHASE) {
      newStage = CustomerDevStatus.STABLE_REPURCHASE
    } else {
      newStage = upgradeStage(newStage, CustomerDevStatus.CLOSED) as CustomerDevStatus
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      lastContactDate:  log.logDate,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      isFollowUp:       isFollowUp !== undefined ? isFollowUp : true,
      devStatus:        newStage,
    },
  })

  // ── 3. 若有下次追蹤日 → 自動建立任務 ─────────────────────
  let taskId: string | null = null
  if (nextFollowUpDate) {
    const task = await prisma.salesTask.create({
      data: {
        title: `追蹤客戶 — ${nextAction ?? '後續跟進'}`,
        taskType: VISIT_TYPES.has(logType) ? 'VISIT' : 'FOLLOW_UP',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: new Date(nextFollowUpDate),
        customerId,
        assignedToId: session.user.id,
        createdById: session.user.id,
        notes: `來自追蹤日誌 ${log.id}\n${nextAction ?? ''}`,
      },
    })
    taskId = task.id
    await prisma.followUpLog.update({
      where: { id: log.id },
      data: { taskCreated: true, taskId },
    })
  }

  // ── 4. 若有提供樣品 → 自動建立樣品紀錄 ──────────────────
  if (hasSample && sampleItems) {
    await prisma.sampleRecord.create({
      data: {
        customerId,
        sentById: session.user.id,
        sentDate: log.logDate,
        items: sampleItems,
        followUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        notes: `來自追蹤日誌 ${log.id}`,
      },
    })
  }

  // ── 5. 若有報價 → 更新銷售機會階段 ──────────────────────
  if (hasQuote && opportunityId) {
    await prisma.salesOpportunity.update({
      where: { id: opportunityId },
      data: { stage: 'QUOTED', updatedAt: new Date() },
    })
  }

  // ── 6. 若有訂單 → 更新銷售機會階段 ──────────────────────
  if (hasOrder && opportunityId) {
    await prisma.salesOpportunity.update({
      where: { id: opportunityId },
      data: { stage: 'REGULAR_ORDER', updatedAt: new Date() },
    })
  }

  return NextResponse.json({ log, taskId })
}

// GET /api/customers/[id]/followup — 取得追蹤日誌列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: customerId } = await params
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const logs = await prisma.followUpLog.findMany({
    where: { customerId },
    include: {
      createdBy: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true, stage: true } },
    },
    orderBy: { logDate: 'desc' },
    take: limit,
    skip: offset,
  })

  return NextResponse.json(logs)
}
