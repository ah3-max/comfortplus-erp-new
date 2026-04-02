import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const po = await prisma.pickingOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, code: true, address: true } },
        warehouse: { select: { name: true, code: true } },
        handler: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: {
          include: {
            product: {
              select: { sku: true, name: true, unit: true },
            },
          },
        },
      },
    })

    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const printDate = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const poDate    = new Date(po.date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })

    const statusLabel: Record<string, string> = {
      PENDING: '待理貨', PICKING: '理貨中', PICKED: '已完成', CANCELLED: '已取消',
    }

    const hasShortPick = po.items.some(i => Number(i.pickedQuantity) > 0 && Number(i.pickedQuantity) < Number(i.quantity))
    const shortPickCount = po.items.filter(i => Number(i.pickedQuantity) > 0 && Number(i.pickedQuantity) < Number(i.quantity)).length

    const rows = po.items.map((item, i) => {
      const qty    = Number(item.quantity)
      const picked = Number(item.pickedQuantity)
      const isShort = picked > 0 && picked < qty
      const rowStyle = isShort ? 'background:#fff3cd' : ''
      return `
        <tr style="${rowStyle}">
          <td>${i + 1}</td>
          <td class="sku">${item.product?.sku ?? ''}</td>
          <td><strong>${item.product?.name ?? item.productName}${item.specification ? `<br><small>${item.specification}</small>` : ''}</strong></td>
          <td class="center bold">${qty}</td>
          <td class="center">${item.product?.unit ?? ''}</td>
          <td class="center picked">${picked > 0 ? picked : '□'}</td>
          <td class="center">${isShort ? `<span class="warn">短撿 ${qty - picked}</span>` : (picked >= qty && picked > 0 ? '✓' : '')}</td>
          <td>${item.memo ?? ''}</td>
        </tr>
      `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<title>揀貨單 ${po.pickingNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111; padding: 15mm; }
  h1 { font-size: 20px; font-weight: 700; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 16px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .info-block { border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; }
  .info-block h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
  .info-label { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
  td.sku { font-family: monospace; font-size: 10px; color: #555; }
  td.center { text-align: center; }
  td.bold { font-weight: 700; }
  td.picked { font-size: 14px; color: #555; }
  .warn { color: #d97706; font-weight: 700; font-size: 10px; }
  .short-alert { margin-top: 12px; padding: 8px 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .sign-box { border-top: 1px solid #555; padding-top: 4px; font-size: 10px; color: #555; text-align: center; }
  @media print { body { padding: 8mm; } button { display: none; } @page { margin: 8mm; } }
</style>
</head>
<body>
<button onclick="window.print()" style="position:fixed;top:12px;right:12px;padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">列印</button>
<h1>揀貨單</h1>
<p class="subtitle">${po.pickingNumber} &nbsp;·&nbsp; ${statusLabel[po.status] ?? po.status} &nbsp;·&nbsp; 列印日期：${printDate}</p>

<div class="header-grid">
  <div class="info-block">
    <h3>客戶資訊</h3>
    <div class="info-row"><span class="info-label">客戶</span><span>${po.customer?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">代碼</span><span>${po.customer?.code ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">地址</span><span>${po.customer?.address ?? '—'}</span></div>
  </div>
  <div class="info-block">
    <h3>作業資訊</h3>
    <div class="info-row"><span class="info-label">建單日期</span><span>${poDate}</span></div>
    <div class="info-row"><span class="info-label">倉庫</span><span>${po.warehouse?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">負責人</span><span>${po.handler?.name ?? '—'}</span></div>
    ${po.scheduledDate ? `<div class="info-row"><span class="info-label">預定出貨</span><span>${new Date(po.scheduledDate).toLocaleDateString('zh-TW')}</span></div>` : ''}
  </div>
  <div class="info-block">
    <h3>配送資訊</h3>
    <div class="info-row"><span class="info-label">收貨地址</span><span>${po.shippingAddress ?? po.customer?.address ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">聯絡資訊</span><span>${po.contactInfo ?? '—'}</span></div>
  </div>
</div>

${hasShortPick ? `<div class="short-alert">⚠️ 注意：有 ${shortPickCount} 項品項短撿，請確認庫存狀況</div>` : ''}

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>料號</th>
      <th>品名</th>
      <th class="center">需撿量</th>
      <th class="center">單位</th>
      <th class="center">實撿量</th>
      <th class="center">差異</th>
      <th>備註</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="8" style="text-align:center;color:#999;">無品項</td></tr>'}
  </tbody>
  <tfoot>
    <tr style="background:#f5f5f5">
      <td colspan="3" style="text-align:right;font-weight:600;">合計</td>
      <td class="center bold">${po.items.reduce((s, i) => s + Number(i.quantity), 0)}</td>
      <td></td>
      <td class="center bold">${po.items.reduce((s, i) => s + Number(i.pickedQuantity), 0)}</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  <div class="sign-box">建單人：${po.createdBy?.name ?? '—'}</div>
  <div class="sign-box">揀貨人：${po.handler?.name ?? '—'}</div>
  <div class="sign-box">複核簽名：＿＿＿＿＿＿＿＿</div>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return handleApiError(error, 'picking-orders.print')
  }
}
