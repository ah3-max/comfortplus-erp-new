import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

/**
 * GET /api/dispatch-orders/[id]/print
 * Returns HTML print page for dispatch order (派車單)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const dispatch = await prisma.dispatchOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, code: true, address: true } },
        warehouse: { select: { name: true, code: true } },
        handler: { select: { name: true } },
        createdBy: { select: { name: true } },
        pickingOrder: { select: { pickingNumber: true } },
        items: {
          include: { product: { select: { sku: true, name: true, unit: true, weight: true } } },
        },
      },
    })

    if (!dispatch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const printDate = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const dispatchDate = new Date(dispatch.date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })

    const totalWeight = dispatch.items.reduce((s, i) => s + Number((i.product as { weight?: number | null })?.weight ?? 0) * Number(i.quantity), 0)
    const totalQty = dispatch.items.reduce((s, i) => s + Number(i.quantity), 0)

    const statusLabel: Record<string, string> = {
      PENDING: '待派送', DISPATCHED: '已派送', DELIVERED: '已送達', CANCELLED: '已取消',
    }

    const rows = dispatch.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="sku">${item.product?.sku ?? ''}</td>
        <td>${item.product?.name ?? item.productName}${item.specification ? `<br><small style="color:#666">${item.specification}</small>` : ''}</td>
        <td class="center">${item.quantity}</td>
        <td class="center">${item.product?.unit ?? ''}</td>
        <td class="center">${(item.product as { weight?: number | null })?.weight ? `${Number((item.product as { weight?: number | null }).weight) * Number(item.quantity)} kg` : '—'}</td>
        <td>${item.memo ?? ''}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<title>派車單 ${dispatch.dispatchNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111; padding: 15mm; }
  h1 { font-size: 20px; font-weight: 700; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 16px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .info-block { border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; }
  .info-block h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
  .info-label { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
  td.sku { font-family: monospace; font-size: 10px; color: #555; }
  td.center { text-align: center; }
  .footer { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .sign-box { border-top: 1px solid #555; padding-top: 4px; font-size: 10px; color: #555; text-align: center; }
  @media print { body { padding: 8mm; } button { display: none; } @page { margin: 8mm; } }
</style>
</head>
<body>
<button onclick="window.print()" style="position:fixed;top:12px;right:12px;padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">列印</button>
<h1>派車單</h1>
<p class="subtitle">${dispatch.dispatchNumber} &nbsp;·&nbsp; ${statusLabel[dispatch.status] ?? dispatch.status} &nbsp;·&nbsp; 列印日期：${printDate}</p>

<div class="header-grid">
  <div class="info-block">
    <h3>收貨方資訊</h3>
    <div class="info-row"><span class="info-label">客戶</span><span>${dispatch.customer?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">代碼</span><span>${dispatch.customer?.code ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">收貨地址</span><span>${dispatch.shippingAddress ?? dispatch.customer?.address ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">聯絡資訊</span><span>${dispatch.contactInfo ?? '—'}</span></div>
    ${dispatch.scheduledDate ? `<div class="info-row"><span class="info-label">預定配送</span><span>${new Date(dispatch.scheduledDate).toLocaleDateString('zh-TW')}</span></div>` : ''}
  </div>
  <div class="info-block">
    <h3>派送資訊</h3>
    <div class="info-row"><span class="info-label">派車單號</span><span class="font-mono">${dispatch.dispatchNumber}</span></div>
    <div class="info-row"><span class="info-label">建單日期</span><span>${dispatchDate}</span></div>
    <div class="info-row"><span class="info-label">倉庫</span><span>${dispatch.warehouse?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">司機/負責人</span><span>${dispatch.handler?.name ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">來源理貨單</span><span>${dispatch.pickingOrder?.pickingNumber ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">總品項</span><span>${dispatch.items.length} 項 / 共 ${totalQty} 個</span></div>
    ${totalWeight > 0 ? `<div class="info-row"><span class="info-label">預估總重</span><span>${totalWeight.toFixed(1)} kg</span></div>` : ''}
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
      <th class="center">重量</th>
      <th>備註</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="7" style="text-align:center;color:#999;">無品項</td></tr>'}
  </tbody>
  <tfoot>
    <tr style="background:#f5f5f5">
      <td colspan="3" style="text-align:right;font-weight:600;">合計</td>
      <td class="center" style="font-weight:700;">${totalQty}</td>
      <td></td>
      <td class="center" style="font-weight:700;">${totalWeight > 0 ? totalWeight.toFixed(1) + ' kg' : '—'}</td>
      <td></td>
    </tr>
  </tfoot>
</table>


<div class="footer">
  <div class="sign-box">建單人：${dispatch.createdBy?.name ?? '—'}</div>
  <div class="sign-box">司機確認：＿＿＿＿＿＿＿＿</div>
  <div class="sign-box">收貨簽名：＿＿＿＿＿＿＿＿</div>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return handleApiError(error, 'dispatch-orders.print')
  }
}
