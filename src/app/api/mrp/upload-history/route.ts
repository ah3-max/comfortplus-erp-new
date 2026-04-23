import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'PROCUREMENT']

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as { role?: string }).role ?? ''
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔案' }, { status: 400 })

    const arrayBuf = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuf)

    const sheet = workbook.worksheets[0]
    if (!sheet) return NextResponse.json({ error: 'Excel 檔案無工作表' }, { status: 400 })

    // Expected columns: SKU | 月份(YYYY-MM) | 數量 | 備註(optional)
    // Or: SKU | 2024-01 | 2024-02 | 2024-03 | ... (pivot format)
    // Detect format by first row
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, colNum) => {
      headers[colNum] = String(cell.value ?? '').trim()
    })

    // Find SKU column
    const skuCol = headers.findIndex(h =>
      /^(sku|品號|商品編號|產品編號)$/i.test(h)
    )
    if (skuCol < 0) {
      return NextResponse.json({
        error: '找不到 SKU 欄位。第一列需包含「SKU」或「品號」標題',
      }, { status: 400 })
    }

    // Detect format: vertical (SKU, 月份, 數量) or pivot (SKU, 2024-01, 2024-02, ...)
    const periodPattern = /^\d{4}-\d{2}$/
    const pivotCols: Array<{ col: number; period: string }> = []
    headers.forEach((h, idx) => {
      if (periodPattern.test(h)) pivotCols.push({ col: idx, period: h })
    })

    const isPivot = pivotCols.length >= 2

    // Resolve all SKUs to product IDs
    const allSkus = new Set<string>()
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const sku = String(row.getCell(skuCol + 1).value ?? '').trim()
      if (sku) allSkus.add(sku)
    })

    const products = await prisma.product.findMany({
      where: { sku: { in: [...allSkus] } },
      select: { id: true, sku: true },
    })
    const skuToId = new Map(products.map(p => [p.sku, p.id]))

    // Parse rows
    const records: Array<{ productId: string; period: string; quantity: number; notes: string | null }> = []
    const errors: string[] = []
    const unknownSkus = new Set<string>()

    if (isPivot) {
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const sku = String(row.getCell(skuCol + 1).value ?? '').trim()
        if (!sku) return
        const productId = skuToId.get(sku)
        if (!productId) { unknownSkus.add(sku); return }

        for (const pc of pivotCols) {
          const val = row.getCell(pc.col + 1).value
          const qty = Number(val)
          if (!isNaN(qty) && qty > 0) {
            records.push({ productId, period: pc.period, quantity: Math.round(qty), notes: null })
          }
        }
      })
    } else {
      // Vertical format: find period and quantity columns
      const periodCol = headers.findIndex(h =>
        /^(月份|period|年月|日期)$/i.test(h)
      )
      const qtyCol = headers.findIndex(h =>
        /^(數量|qty|quantity|銷量|出貨量)$/i.test(h)
      )
      const notesCol = headers.findIndex(h =>
        /^(備註|notes|note)$/i.test(h)
      )

      if (periodCol < 0 || qtyCol < 0) {
        return NextResponse.json({
          error: '需包含「月份」(YYYY-MM) 和「數量」欄位',
        }, { status: 400 })
      }

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const sku = String(row.getCell(skuCol + 1).value ?? '').trim()
        if (!sku) return
        const productId = skuToId.get(sku)
        if (!productId) { unknownSkus.add(sku); return }

        let period = String(row.getCell(periodCol + 1).value ?? '').trim()
        if (!periodPattern.test(period)) {
          // Try to parse as date
          const cellVal = row.getCell(periodCol + 1).value
          if (cellVal instanceof Date) {
            period = `${cellVal.getFullYear()}-${String(cellVal.getMonth() + 1).padStart(2, '0')}`
          } else {
            errors.push(`第 ${rowNum} 列：月份格式錯誤 (${period})，需 YYYY-MM`)
            return
          }
        }

        const qty = Number(row.getCell(qtyCol + 1).value)
        if (isNaN(qty) || qty < 0) {
          errors.push(`第 ${rowNum} 列：數量無效 (${row.getCell(qtyCol + 1).value})`)
          return
        }

        const notes = notesCol >= 0 ? String(row.getCell(notesCol + 1).value ?? '').trim() || null : null
        records.push({ productId, period, quantity: Math.round(qty), notes })
      })
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: '無有效資料可匯入',
        details: { errors, unknownSkus: [...unknownSkus] },
      }, { status: 422 })
    }

    // Upsert all records
    let imported = 0
    for (const rec of records) {
      await prisma.mrpDemandHistory.upsert({
        where: {
          productId_period_source: {
            productId: rec.productId,
            period: rec.period,
            source: 'IMPORTED',
          },
        },
        update: { quantity: rec.quantity, notes: rec.notes },
        create: {
          productId: rec.productId,
          period: rec.period,
          quantity: rec.quantity,
          source: 'IMPORTED',
          notes: rec.notes,
        },
      })
      imported++
    }

    return NextResponse.json({
      message: `匯入完成`,
      imported,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      unknownSkus: unknownSkus.size > 0 ? [...unknownSkus] : undefined,
    })
  } catch (error) {
    return handleApiError(error, 'mrp.upload-history')
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const records = await prisma.mrpDemandHistory.findMany({
      where: { source: 'IMPORTED' },
      include: { product: { select: { sku: true, name: true } } },
      orderBy: [{ period: 'desc' }, { product: { sku: 'asc' } }],
      take: 500,
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    return handleApiError(error, 'mrp.upload-history.GET')
  }
}
