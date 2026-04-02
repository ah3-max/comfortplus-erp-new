import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { notify } from '@/lib/notify'

/**
 * POST /api/quotations/[id]/send
 * S-1: Send quotation to customer via Email and/or LINE notification
 *
 * Body: { channels: ('email' | 'line')[], message?: string }
 *
 * - Marks quotation status as SENT if it's in DRAFT/APPROVED state
 * - Sends email to customer's email address (if SMTP configured)
 * - Sends LINE notify (if LINE Notify Token configured)
 * - Creates in-app notification for the sales rep
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, contactPerson: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: { select: { name: true, sku: true, unit: true } } },
        },
      },
    })
    if (!quotation) return NextResponse.json({ error: '找不到報價單' }, { status: 404 })
    if (!['DRAFT', 'APPROVED', 'PENDING_APPROVAL'].includes(quotation.status)) {
      return NextResponse.json({ error: `報價單狀態 ${quotation.status} 無法發送` }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const channels: string[] = body.channels ?? ['email']
    const customMessage: string = body.message ?? ''

    const fmt = (n: number | string) =>
      new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(n))

    // Build email content
    const itemsTable = quotation.items.map(i => {
      const subtotal = Number(i.quantity) * Number(i.unitPrice) * (1 - Number(i.discount) / 100)
      return `• ${i.product.name} (${i.product.sku}) × ${i.quantity} ${i.product.unit} = ${fmt(subtotal)}`
    }).join('\n')

    const emailSubject = `【報價單】${quotation.quotationNo} — ${quotation.customer.name}`
    const emailBody = `${customMessage ? customMessage + '\n\n' : ''}報價單號：${quotation.quotationNo}
客戶：${quotation.customer.name}
有效期限：${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('zh-TW') : '不限'}

品項明細：
${itemsTable}

總金額：${fmt(Number(quotation.totalAmount))}

${quotation.notes ? '備注：' + quotation.notes : ''}

如有任何問題請聯繫我們的業務。`

    const sentChannels: string[] = []

    // Send email if configured and customer has email
    if (channels.includes('email') && quotation.customer.email) {
      await notify({
        emails: [quotation.customer.email],
        title: emailSubject,
        message: emailBody,
        linkUrl: `/quotations`,
        category: 'QUOTATION_SENT',
      })
      sentChannels.push('email')
    }

    // LINE notification (group/broadcast) — send to sales rep's line
    if (channels.includes('line')) {
      await notify({
        line: true,
        title: `📋 報價單 ${quotation.quotationNo} 已發送`,
        message: `客戶：${quotation.customer.name}\n總金額：${fmt(Number(quotation.totalAmount))}\n${customMessage ? '備注：' + customMessage : ''}`,
        linkUrl: `/quotations`,
        category: 'QUOTATION_SENT',
      })
      sentChannels.push('line')
    }

    // Mark as SENT
    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: 'SENT' },
    })

    // In-app notification for creator
    await notify({
      userIds: [quotation.createdById],
      title: `✅ 報價單已發送`,
      message: `${quotation.quotationNo} 已透過 ${sentChannels.join('、')} 發送給 ${quotation.customer.name}`,
      linkUrl: `/quotations`,
      category: 'QUOTATION_SENT',
    })

    return NextResponse.json({
      ok: true,
      status: updated.status,
      sentChannels,
      sentTo: quotation.customer.email ?? '',
    })
  } catch (error) {
    return handleApiError(error, 'quotations.send')
  }
}
