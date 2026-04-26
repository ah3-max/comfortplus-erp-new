import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'
import type { MrpResult, MrpSkuResult } from '@/lib/mrp'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT', 'WAREHOUSE_MANAGER', 'FINANCE']

const URGENCY_LABEL: Record<string, string> = {
  CRITICAL: '立即採購', WARNING: '注意', NORMAL: '正常', OK: '充足',
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snapshotId = req.nextUrl.searchParams.get('id')
    let result: MrpResult
    let runAt: string
    let runBy = ''

    if (snapshotId) {
      const snapshot = await prisma.mrpSnapshot.findUnique({
        where: { id: snapshotId },
        select: { resultJson: true, runAt: true, runBy: { select: { name: true } } },
      })
      if (!snapshot) return NextResponse.json({ error: '找不到此 snapshot' }, { status: 404 })
      result = JSON.parse(snapshot.resultJson) as MrpResult
      runAt = snapshot.runAt.toISOString()
      runBy = snapshot.runBy.name ?? ''
    } else {
      return NextResponse.json({ error: '請提供 snapshot id' }, { status: 400 })
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'ComfortPlus ERP'
    wb.created = new Date()

    // ── Sheet 1: 摘要 ──────────────────────────────────────────────────────────
    const summarySheet = wb.addWorksheet('MRP 摘要')
    summarySheet.columns = [
      { header: '項目', key: 'label', width: 20 },
      { header: '數值', key: 'value', width: 15 },
    ]
    const { summary } = result
    const summaryRows = [
      { label: '計算時間', value: new Date(runAt).toLocaleString('zh-TW') },
      { label: '執行人', value: runBy },
      { label: '總 SKU 數', value: summary.totalSkus },
      { label: '立即採購', value: summary.criticalCount },
      { label: '注意', value: summary.warningCount },
      { label: '正常', value: summary.normalCount },
      { label: '充足', value: summary.okCount },
    ]
    summarySheet.addRows(summaryRows)
    summarySheet.getRow(1).font = { bold: true }

    // ── Sheet 2: 明細 ──────────────────────────────────────────────────────────
    const detailSheet = wb.addWorksheet('MRP 明細')
    detailSheet.columns = [
      { header: '狀態', key: 'urgency', width: 12 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: '品名', key: 'productName', width: 30 },
      { header: '分類', key: 'category', width: 14 },
      { header: '月均需求', key: 'avgMonthlyDemand', width: 12 },
      { header: '歷史月數', key: 'demandMonths', width: 10 },
      { header: '下月預測', key: 'forecastNextMonth', width: 12 },
      { header: '帳面庫存', key: 'currentStock', width: 12 },
      { header: '可用庫存', key: 'availableStock', width: 12 },
      { header: '安全庫存', key: 'safetyStock', width: 12 },
      { header: '已預留', key: 'reservedQty', width: 10 },
      { header: '在途數量', key: 'inTransitQty', width: 10 },
      { header: '在途 PO', key: 'inTransitPoNos', width: 20 },
      { header: '淨需求', key: 'netRequirement', width: 12 },
      { header: '距安全庫存天數', key: 'daysUntilSafetyStock', width: 16 },
      { header: '安全庫存觸及日', key: 'burndownDate', width: 16 },
      { header: '供應商', key: 'supplierName', width: 20 },
      { header: '交期(天)', key: 'leadTimeDays', width: 10 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: '建議採購量', key: 'suggestedOrderQty', width: 12 },
      { header: '建議下單日', key: 'suggestedOrderDate', width: 14 },
      { header: '原因說明', key: 'urgencyReason', width: 40 },
    ]

    const headerRow = detailSheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

    const urgencyFill: Record<string, string> = {
      CRITICAL: 'FFFEE2E2',
      WARNING:  'FFFEF3C7',
      NORMAL:   'FFDBEAFE',
      OK:       'FFD1FAE5',
    }

    result.skus.forEach((s: MrpSkuResult) => {
      const row = detailSheet.addRow({
        urgency: URGENCY_LABEL[s.urgency] ?? s.urgency,
        sku: s.sku,
        productName: s.productName,
        category: s.category,
        avgMonthlyDemand: s.avgMonthlyDemand,
        demandMonths: s.demandMonths,
        forecastNextMonth: s.forecastNextMonth,
        currentStock: s.currentStock,
        availableStock: s.availableStock,
        safetyStock: s.safetyStock,
        reservedQty: s.reservedQty,
        inTransitQty: s.inTransitQty,
        inTransitPoNos: s.inTransitPoNos.join(', '),
        netRequirement: s.netRequirement,
        daysUntilSafetyStock: s.daysUntilSafetyStock === 999 ? '—' : s.daysUntilSafetyStock,
        burndownDate: s.burndownDate ?? '—',
        supplierName: s.supplierName ?? '未設定',
        leadTimeDays: s.leadTimeDays,
        moq: s.moq,
        suggestedOrderQty: s.suggestedOrderQty > 0 ? s.suggestedOrderQty : '—',
        suggestedOrderDate: s.suggestedOrderDate ?? '—',
        urgencyReason: s.urgencyReason,
      })
      const fill = urgencyFill[s.urgency]
      if (fill) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      }
    })

    // ── Sheet 3: 需採購清單（CRITICAL + WARNING） ──────────────────────────────
    const actionSheet = wb.addWorksheet('需採購清單')
    actionSheet.columns = [
      { header: '狀態', key: 'urgency', width: 12 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: '品名', key: 'productName', width: 30 },
      { header: '供應商', key: 'supplierName', width: 20 },
      { header: '建議採購量', key: 'suggestedOrderQty', width: 12 },
      { header: '建議下單日', key: 'suggestedOrderDate', width: 14 },
      { header: '交期(天)', key: 'leadTimeDays', width: 10 },
      { header: '原因說明', key: 'urgencyReason', width: 40 },
    ]
    const actionHeader = actionSheet.getRow(1)
    actionHeader.font = { bold: true }
    actionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

    const actionSkus = result.skus.filter(
      (s: MrpSkuResult) => (s.urgency === 'CRITICAL' || s.urgency === 'WARNING') && s.suggestedOrderQty > 0
    )
    actionSkus.forEach((s: MrpSkuResult) => {
      const row = actionSheet.addRow({
        urgency: URGENCY_LABEL[s.urgency],
        sku: s.sku,
        productName: s.productName,
        supplierName: s.supplierName ?? '未設定',
        suggestedOrderQty: s.suggestedOrderQty,
        suggestedOrderDate: s.suggestedOrderDate ?? '—',
        leadTimeDays: s.leadTimeDays,
        urgencyReason: s.urgencyReason,
      })
      if (s.urgency === 'CRITICAL') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      } else {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      }
    })

    const buf = await wb.xlsx.writeBuffer()
    const filename = `MRP_${new Date(runAt).toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'mrp.export')
  }
}
