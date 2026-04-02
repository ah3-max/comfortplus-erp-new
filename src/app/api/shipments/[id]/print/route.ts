import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
          },
        },
        logisticsProvider: true,
        createdBy: { select: { name: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true, weight: true } } },
        },
      },
    })

    if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const customer = shipment.order?.customer
    const items = shipment.items

    const rows = items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="sku">${item.product?.sku ?? ''}</td>
        <td>${item.product?.name ?? ''}</td>
        <td class="center">${item.quantity}</td>
        <td class="center">${item.product?.unit ?? ''}</td>
        <td class="center">${item.boxCount ?? ''}</td>
        <td>${item.notes ?? ''}</td>
      </tr>
    `).join('')

    const printDate = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const shipDate  = shipment.shipDate
      ? new Date(shipment.shipDate).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '—'
    const expectedDate = shipment.expectedDeliveryDate
      ? new Date(shipment.expectedDeliveryDate).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '—'

    const deliveryMethodLabel: Record<string, string> = {
      EXPRESS: '快遞',
      FREIGHT: '貨運',
      OWN_FLEET: '自有車隊',
      SELF_PICKUP: '自取',
    }

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>出貨單 ${shipment.shipmentNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111; padding: 20mm; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #555; margin-bottom: 20px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .info-block { border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; }
  .info-block h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #666; margin-bottom: 8px; letter-spacing: 0.05em; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .info-label { color: #666; }
  .info-value { font-weight: 500; text-align: right; max-width: 55%; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f5f5f5; border: 1px solid #ddd; padding: 7px 10px; text-align: left; font-size: 11px; }
  td { border: 1px solid #ddd; padding: 7px 10px; font-size: 12px; }
  td.center, th.center { text-align: center; }
  td.sku { font-family: monospace; font-size: 11px; color: #555; }
  .footer { margin-top: 32px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .sign-box { border-top: 1px solid #555; padding-top: 6px; font-size: 11px; color: #555; text-align: center; }
  .badge { display: inline-block; border: 1px solid #aaa; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
  @media print {
    body { padding: 10mm; }
    button { display: none; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
<button onclick="window.print()" style="position:fixed;top:16px;right:16px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">列印</button>
<h1>出貨單</h1>
<p class="subtitle">${shipment.shipmentNo} &nbsp;·&nbsp; 列印日期：${printDate}</p>

<div class="header-grid">
  <div class="info-block">
    <h3>收貨方資訊</h3>
    <div class="info-row"><span class="info-label">客戶</span><span class="info-value">${customer?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">客戶代碼</span><span class="info-value">${customer?.code ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">地址</span><span class="info-value">${customer?.address ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">聯絡電話</span><span class="info-value">${(customer as { phone?: string })?.phone ?? '—'}</span></div>
  </div>
  <div class="info-block">
    <h3>出貨資訊</h3>
    <div class="info-row"><span class="info-label">訂單編號</span><span class="info-value">${shipment.order?.orderNo ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">出貨方式</span><span class="info-value">${deliveryMethodLabel[shipment.deliveryMethod] ?? shipment.deliveryMethod}</span></div>
    <div class="info-row"><span class="info-label">物流商</span><span class="info-value">${shipment.logisticsProvider?.name ?? shipment.carrier ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">追蹤號碼</span><span class="info-value">${shipment.trackingNo ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">出貨日期</span><span class="info-value">${shipDate}</span></div>
    <div class="info-row"><span class="info-label">預計到貨</span><span class="info-value">${expectedDate}</span></div>
    <div class="info-row"><span class="info-label">棧板/箱數</span><span class="info-value">${shipment.palletCount ?? '—'} 板 / ${shipment.boxCount ?? '—'} 箱</span></div>
    <div class="info-row"><span class="info-label">總重量</span><span class="info-value">${shipment.weight ? shipment.weight + ' kg' : '—'}</span></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>料號</th>
      <th>品名</th>
      <th class="center">數量</th>
      <th class="center">單位</th>
      <th class="center">箱數</th>
      <th>備註</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="7" style="text-align:center;color:#999;">無品項</td></tr>'}
  </tbody>
</table>

${shipment.notes ? `<p style="margin-top:12px;font-size:11px;color:#555;">備註：${shipment.notes}</p>` : ''}

<div class="footer">
  <div class="sign-box">製單人：${shipment.createdBy?.name ?? '—'}</div>
  <div class="sign-box">發貨核對：＿＿＿＿＿＿＿＿</div>
  <div class="sign-box">收貨簽名：＿＿＿＿＿＿＿＿</div>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return handleApiError(error, 'shipments.print')
  }
}
