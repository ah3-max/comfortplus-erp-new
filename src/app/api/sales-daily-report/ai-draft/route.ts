import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { aiChat } from '@/lib/ai'

/**
 * POST /api/sales-daily-report/ai-draft
 *
 * 讓 AI 根據今日實際活動（拜訪、通話、訂單、報價、追蹤日誌）自動草擬：
 *   highlights   — 今日重點（LLM 2-3 句精簡）
 *   obstacles    — 遭遇困難
 *   tomorrowPlan — 明日計畫
 *
 * Response: { highlights, obstacles, tomorrowPlan, facts }
 * 不直接寫入 DB，只回文字給前端填回表單；使用者可再編輯後按「送出」或「一鍵送出」。
 */
export async function POST(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [visits, calls, newOrders, quotes, logs, followUpDue] = await Promise.all([
      prisma.visitRecord.findMany({
        where: { visitedById: userId, visitDate: { gte: today, lt: tomorrow } },
        include: { customer: { select: { name: true, devStatus: true } } },
        take: 20,
      }),
      prisma.callRecord.findMany({
        where: { calledById: userId, callDate: { gte: today, lt: tomorrow } },
        include: { customer: { select: { name: true } } },
        take: 20,
      }),
      prisma.salesOrder.findMany({
        where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } },
        select: { orderNo: true, totalAmount: true, customer: { select: { name: true } } },
        take: 20,
      }),
      prisma.quotation.findMany({
        where: { createdById: userId, createdAt: { gte: today, lt: tomorrow } },
        select: { quotationNo: true, totalAmount: true, status: true, customer: { select: { name: true } } },
        take: 20,
      }),
      prisma.followUpLog.findMany({
        where: { createdById: userId, logDate: { gte: today, lt: tomorrow } },
        select: { logType: true, content: true, result: true, customer: { select: { name: true } } },
        take: 30,
      }),
      // Tomorrow's scheduled follow-ups
      prisma.salesTask.findMany({
        where: {
          assignedToId: userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) },
        },
        select: { title: true, customer: { select: { name: true } } },
        take: 10,
      }),
    ])

    const orderTotal = newOrders.reduce((s, o) => s + Number(o.totalAmount), 0)
    const quoteTotal = quotes.reduce((s, q) => s + Number(q.totalAmount), 0)

    const facts = {
      visits: visits.length,
      calls: calls.length,
      orders: newOrders.length,
      orderAmount: orderTotal,
      quotes: quotes.length,
      quoteAmount: quoteTotal,
      followUps: logs.length,
      tomorrowTasks: followUpDue.length,
    }

    // Short-circuit: no activity today
    if (visits.length + calls.length + newOrders.length + quotes.length + logs.length === 0) {
      return NextResponse.json({
        highlights: '今日無活動紀錄。',
        obstacles: '',
        tomorrowPlan: followUpDue.length > 0
          ? `明日預定：${followUpDue.map(t => `${t.customer?.name ?? ''}（${t.title}）`).join('、')}`
          : '',
        facts,
      })
    }

    // Build a compact activity summary for the prompt
    const activityLines: string[] = []
    if (newOrders.length > 0) {
      activityLines.push(`訂單 ${newOrders.length} 筆（金額 ${orderTotal.toLocaleString()}）：` +
        newOrders.slice(0, 5).map(o => `${o.customer?.name ?? ''} ${o.orderNo}`).join('、'))
    }
    if (quotes.length > 0) {
      activityLines.push(`報價 ${quotes.length} 筆：` +
        quotes.slice(0, 5).map(q => `${q.customer?.name ?? ''}（${q.status}）`).join('、'))
    }
    if (visits.length > 0) {
      activityLines.push(`拜訪 ${visits.length} 家：` +
        visits.slice(0, 8).map(v => `${v.customer?.name ?? ''}（${v.customer?.devStatus ?? ''}）`).join('、'))
    }
    if (calls.length > 0) {
      activityLines.push(`電訪 ${calls.length} 通：` +
        calls.slice(0, 8).map(c => c.customer?.name ?? '').filter(Boolean).join('、'))
    }
    if (logs.length > 0) {
      activityLines.push(`追蹤日誌 ${logs.length} 筆，含重要內容：\n` +
        logs.slice(0, 8).map(l => `  - [${l.logType}] ${l.customer?.name ?? ''}：${(l.content ?? '').slice(0, 80)}`).join('\n'))
    }
    if (followUpDue.length > 0) {
      activityLines.push(`明日預定任務：` +
        followUpDue.map(t => `${t.customer?.name ?? ''}（${t.title}）`).join('、'))
    }

    const systemPrompt = `你是業務日報助手。根據業務今日的實際活動數據，草擬三段文字：
1. 今日重點（highlights）：2-3 句話總結今天最有價值的成果與互動，具體指出客戶名與事項
2. 遭遇困難（obstacles）：若追蹤日誌有提到困難、客戶反對、競品等，濃縮成 1-2 句；若無則留空
3. 明日計畫（tomorrowPlan）：根據今日未結案的追蹤 + 明日預定任務，列 2-3 項具體行動

僅用繁體中文。不要寒暄、不要編號、不要列點符號，三段分別用自然句子回覆。
嚴格用以下 JSON 格式回覆（不要包 markdown code fence）：
{"highlights": "...", "obstacles": "...", "tomorrowPlan": "..."}`

    const userPrompt = `今日活動統計：
${activityLines.join('\n')}`

    const ai = await aiChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 600,
    })

    // Best-effort JSON parse — fall back to raw text in highlights
    let draft = { highlights: '', obstacles: '', tomorrowPlan: '' }
    try {
      const m = ai.content.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0]) as Partial<typeof draft>
        draft = {
          highlights: (parsed.highlights ?? '').trim(),
          obstacles: (parsed.obstacles ?? '').trim(),
          tomorrowPlan: (parsed.tomorrowPlan ?? '').trim(),
        }
      } else {
        draft.highlights = ai.content.trim().slice(0, 300)
      }
    } catch {
      draft.highlights = ai.content.trim().slice(0, 300)
    }

    return NextResponse.json({
      ...draft,
      facts,
      provider: ai.provider,
    })
  } catch (e) {
    return handleApiError(e, 'salesDailyReport.aiDraft')
  }
}
