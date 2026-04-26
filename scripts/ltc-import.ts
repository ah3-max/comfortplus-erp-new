import { prisma } from '../src/lib/prisma'
import ExcelJS from 'exceljs'

const HEADER_MAP: Record<string, string> = {
  '機構名稱': 'name', '區域': 'district', '區域(2)': 'region', '縣市': 'city',
  '完整地址': 'address', '窗口': 'contactPerson', '電話': 'phone',
  '床數': 'bedCount', '使用品牌': 'currentBrand', '收案對象': 'carePopulation',
  '報價備註': 'quotationNotes', '歷史紀錄': 'historyLog', '提供樣品': 'sampleProvided',
  '結帳備註': 'billingNotes', '業務': 'assignedSalesName', '備註': 'notes',
  '他牌股東': 'competitorShareholders', '聯繫結果': 'contactResultLatest',
  '昨日聯繫': 'contactResultLatest', '本月聯繫次數': 'monthlyContactCount',
}

async function main() {
  const FILE = process.argv[2]
  if (!FILE) { console.error('用法: npx tsx scripts/ltc-import.ts <excel.xlsx>'); process.exit(1) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FILE)
  const ws = wb.worksheets[0]

  const colMap: Record<string, number> = {}
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colNumber: number) => {
    const h = String(cell.value ?? '').trim()
    if (HEADER_MAP[h]) colMap[HEADER_MAP[h]] = colNumber
  })
  console.log('欄位對應:', JSON.stringify(colMap))
  console.log('總資料列數:', ws.rowCount - 1)

  const rows: Array<{ rowNumber: number; row: ExcelJS.Row }> = []
  ws.eachRow((row: ExcelJS.Row, rowNumber: number) => { if (rowNumber > 1) rows.push({ rowNumber, row }) })

  const customers = await prisma.customer.findMany({ select: { id: true, name: true, code: true } })
  const byName = new Map(customers.map(c => [c.name.trim(), c]))
  const byCode = new Map(customers.map(c => [c.code.trim().toUpperCase(), c]))

  const get = (row: ExcelJS.Row, field: string): string => {
    const idx = colMap[field]; if (!idx) return ''
    const v = row.getCell(idx).value
    return (v === null || v === undefined) ? '' : String(v).trim()
  }

  const result = { updated: 0, skipped: 0, notFound: [] as string[] }

  for (const { rowNumber, row } of rows) {
    const name = get(row, 'name')
    if (!name) { result.skipped++; continue }
    const cust = byName.get(name) ?? byCode.get(name.toUpperCase())
    if (!cust) { result.notFound.push(`Row ${rowNumber}: 「${name}」`); continue }

    const payload: Record<string, unknown> = {}
    const strFields = ['city','district','currentBrand','assignedSalesName','carePopulation',
      'quotationNotes','sampleProvided','billingNotes','competitorShareholders',
      'contactResultLatest','historyLog']
    for (const f of strFields) { const v = get(row, f); if (v) payload[f] = v }
    const bedRaw = get(row, 'bedCount'); if (bedRaw) { const n = parseInt(bedRaw); if (!isNaN(n)) payload.bedCount = n }
    const moRaw = get(row, 'monthlyContactCount'); if (moRaw) { const n = parseInt(moRaw); if (!isNaN(n)) payload.monthlyContactCount = n }

    if (Object.keys(payload).length > 0) {
      await prisma.customer.update({ where: { id: cust.id }, data: payload })
      result.updated++
    } else {
      result.skipped++
    }
  }

  console.log('\n=== 結果 ===')
  console.log(`updated: ${result.updated}`)
  console.log(`skipped (空列): ${result.skipped}`)
  console.log(`notFound: ${result.notFound.length}`)
  if (result.notFound.length > 0) console.log(result.notFound.join('\n'))

  // Stats
  const stats = await prisma.customer.aggregate({
    _count: { _all: true, bedCount: true, currentBrand: true, assignedSalesName: true },
    _sum: { bedCount: true },
  })
  console.log('\n=== DB 統計 ===')
  console.log(`total: ${stats._count._all}`)
  console.log(`has_bed_count: ${stats._count.bedCount}`)
  console.log(`has_brand: ${stats._count.currentBrand}`)
  console.log(`has_sales: ${stats._count.assignedSalesName}`)
  console.log(`total_beds: ${stats._sum.bedCount}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
