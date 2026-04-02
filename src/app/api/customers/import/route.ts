import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES']

// Expected Excel columns (index 0-based):
// 0: 機構名稱 (name) *required
// 1: 分級 (grade) A/B/C/D
// 2: 機構類型 (type) e.g. NURSING_HOME
// 3: 縣市 (city)
// 4: 地址 (address)
// 5: 電話 (phone)
// 6: 聯絡人 (contactPerson)
// 7: 床數 (bedCount)
// 8: 業務區域 (region)
// 9: 備註 (notes)

const GRADE_MAP: Record<string, string> = { A: 'A', B: 'B', C: 'C', D: 'D', a: 'A', b: 'B', c: 'C', d: 'D' }

const TYPE_MAP: Record<string, string> = {
  '護理之家': 'NURSING_HOME',
  '養老院': 'CARE_HOME',
  '老福法': 'ELDERLY_HOME',
  '社團法人': 'SOCIAL_WELFARE',
  '日照': 'DAY_CARE',
  '居家': 'HOME_CARE',
  '醫院': 'HOSPITAL',
  '藥局': 'PHARMACY_CHANNEL',
  '通路': 'MEDICAL_CHANNEL',
  '電商': 'B2C_OTHER',
  'NURSING_HOME': 'NURSING_HOME',
  'CARE_HOME': 'CARE_HOME',
  'ELDERLY_HOME': 'ELDERLY_HOME',
  'SOCIAL_WELFARE': 'SOCIAL_WELFARE',
  'DAY_CARE': 'DAY_CARE',
  'HOME_CARE': 'HOME_CARE',
  'HOSPITAL': 'HOSPITAL',
  'DISTRIBUTOR': 'DISTRIBUTOR',
}

const REGION_MAP: Record<string, string> = {
  '北北桃': 'NORTH_METRO', '台北': 'NORTH_METRO', '新北': 'NORTH_METRO', '桃園': 'NORTH_METRO',
  '基隆': 'KEELUNG_YILAN', '宜蘭': 'KEELUNG_YILAN',
  '新竹': 'HSINCHU_MIAOLI', '苗栗': 'HSINCHU_MIAOLI',
  '台中': 'TAICHUNG_AREA', '彰化': 'TAICHUNG_AREA', '南投': 'TAICHUNG_AREA',
  '雲林': 'YUNLIN_CHIAYI', '嘉義': 'YUNLIN_CHIAYI',
  '台南': 'TAINAN_AREA',
  '高雄': 'KAOHSIUNG_AREA', '屏東': 'KAOHSIUNG_AREA',
  '花蓮': 'HUALIEN_TAITUNG', '台東': 'HUALIEN_TAITUNG',
  'NORTH_METRO': 'NORTH_METRO', 'KEELUNG_YILAN': 'KEELUNG_YILAN',
}

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text)
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result)
  return String(v).trim()
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳 Excel 檔案' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer: any = Buffer.from(new Uint8Array(bytes))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    if (!sheet) return NextResponse.json({ error: 'Excel 無工作表' }, { status: 400 })

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

    // Generate sequential codes: get max existing code
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'C' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    let codeSeq = lastCustomer?.code ? (parseInt(lastCustomer.code.replace(/\D/g, '')) || 0) : 0

    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) rows.push(row) // skip header
    })

    for (const row of rows) {
      const name        = cellStr(row.getCell(1))
      const gradeRaw    = cellStr(row.getCell(2))
      const typeRaw     = cellStr(row.getCell(3))
      const city        = cellStr(row.getCell(4))
      const address     = cellStr(row.getCell(5))
      const phone       = cellStr(row.getCell(6))
      const contactPerson = cellStr(row.getCell(7))
      const bedCountRaw = cellStr(row.getCell(8))
      const regionRaw   = cellStr(row.getCell(9))
      const notes       = cellStr(row.getCell(10))

      if (!name) { results.skipped++; continue }

      const grade    = GRADE_MAP[gradeRaw]     ?? null
      const type     = TYPE_MAP[typeRaw]        ?? 'NURSING_HOME'
      const region   = REGION_MAP[regionRaw]    ?? REGION_MAP[city] ?? null
      const bedCount = bedCountRaw ? parseInt(bedCountRaw) || null : null

      // Check if customer with same name already exists
      const existing = await prisma.customer.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })

      if (existing) {
        // Update grade/phone/address if provided
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            ...(grade   ? { grade: grade as never } : {}),
            ...(phone   ? { phone } : {}),
            ...(address ? { address } : {}),
            ...(city    ? { city } : {}),
            ...(region  ? { region: region as never } : {}),
            ...(bedCount ? { bedCount } : {}),
            ...(notes   ? { notes } : {}),
          },
        })
        results.updated++
      } else {
        codeSeq++
        const code = `C${String(codeSeq).padStart(5, '0')}`
        await prisma.customer.create({
          data: {
            code,
            name,
            type: type as never,
            grade: grade ? (grade as never) : undefined,
            city: city || null,
            address: address || null,
            phone: phone || null,
            contactPerson: contactPerson || null,
            bedCount,
            region: region ? (region as never) : null,
            notes: notes || null,
            devStatus: 'POTENTIAL',
          },
        })
        results.created++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'customers.import')
  }
}

// GET — return Excel template for download
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('機構名單')

  sheet.columns = [
    { header: '機構名稱 *', key: 'name', width: 30 },
    { header: '分級 (A/B/C/D)', key: 'grade', width: 16 },
    { header: '機構類型', key: 'type', width: 20 },
    { header: '縣市', key: 'city', width: 10 },
    { header: '地址', key: 'address', width: 35 },
    { header: '電話', key: 'phone', width: 15 },
    { header: '聯絡人', key: 'contactPerson', width: 12 },
    { header: '床數', key: 'bedCount', width: 8 },
    { header: '業務區域', key: 'region', width: 20 },
    { header: '備註', key: 'notes', width: 25 },
  ]

  // Style header row
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  // Add example row
  sheet.addRow({
    name: '範例護理之家', grade: 'A', type: '護理之家', city: '台北市',
    address: '台北市大安區範例路1號', phone: '02-12345678',
    contactPerson: '王主任', bedCount: 60, region: '北北桃', notes: '月結30天',
  })

  // Add notes sheet
  const notesSheet = workbook.addWorksheet('說明')
  notesSheet.addRow(['欄位', '說明', '選項'])
  notesSheet.addRow(['機構名稱', '必填', ''])
  notesSheet.addRow(['分級', 'A=高收費高品質 B=低收費高品質 C=高收費低品質 D=低品質(建議放棄)', 'A / B / C / D'])
  notesSheet.addRow(['機構類型', '', '護理之家 / 養老院 / 老福法 / 社團法人 / 日照 / 居家 / 醫院'])
  notesSheet.addRow(['業務區域', '', '北北桃 / 基隆 / 宜蘭 / 新竹 / 苗栗 / 台中 / 彰化 / 南投 / 台南 / 高雄 / 屏東'])
  notesSheet.getColumn(1).width = 12
  notesSheet.getColumn(2).width = 60
  notesSheet.getColumn(3).width = 50

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="institution_import_template.xlsx"',
    },
  })
}
