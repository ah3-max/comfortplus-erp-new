import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import ExcelJS from 'exceljs'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES']

// Excel header → column index map (1-based, auto-detected by header name)
const HEADER_MAP: Record<string, string> = {
  '機構名稱': 'name',
  '區域':     'district',
  '區域(2)':  'region',
  '縣市':     'city',
  '完整地址': 'address',
  '窗口':     'contactPerson',
  '電話':     'phone',
  '傳真':     'fax',
  'email':    'email',
  'Email':    'email',
  'EMAIL':    'email',
  '床數':     'bedCount',
  '使用品牌': 'currentBrand',
  '耗材另計或包月': 'billingMode',
  '收案對象': 'carePopulation',
  '報價備註': 'quotationNotes',
  '歷史紀錄': 'historyLog',
  '提供樣品': 'sampleProvided',
  '結帳方式': 'collectionMethod',
  '結帳備註': 'billingNotes',
  '業務':     'assignedSalesName',
  '備註':     'notes',
  '他牌股東': 'competitorShareholders',
  '聯繫結果': 'contactResultLatest',
  '昨日聯繫': 'contactResultLatest',
  '本月聯繫次數': 'monthlyContactCount',
  '狀態評分': 'statusScore',
  '最新聯繫': 'lastContactedAt',
  '初訪':     'firstVisitAt',
  '再追蹤':   'nextFollowUpAt',
  '是否續追': 'continueFollowing',
}

const REGION_MAP: Record<string, string> = {
  '北北桃': 'NORTH_METRO', '台北': 'NORTH_METRO', '台北市': 'NORTH_METRO',
  '新北': 'NORTH_METRO', '新北市': 'NORTH_METRO', '桃園': 'NORTH_METRO',
  '基隆': 'KEELUNG_YILAN', '宜蘭': 'KEELUNG_YILAN',
  '新竹': 'HSINCHU_MIAOLI', '苗栗': 'HSINCHU_MIAOLI',
  '台中': 'TAICHUNG_AREA', '彰化': 'TAICHUNG_AREA', '南投': 'TAICHUNG_AREA',
  '雲林': 'YUNLIN_CHIAYI', '嘉義': 'YUNLIN_CHIAYI',
  '台南': 'TAINAN_KAOHSIUNG', '高雄': 'TAINAN_KAOHSIUNG', '屏東': 'TAINAN_KAOHSIUNG',
  '花蓮': 'HUALIEN_TAITUNG', '台東': 'HUALIEN_TAITUNG',
}

// Strip common suffixes to extract institution core name for fuzzy matching
const STRIP_WORDS = [
  '台灣省私立', '台灣省公立', '台北市私立', '台北市公立',
  '新北市私立', '新北市公立', '桃園市私立', '桃園市公立',
  '私立', '公立', '財團法人', '社團法人', '機構附設',
  '老人長期照顧中心', '長期照顧中心', '老人安養護中心', '老人安養中心',
  '老人養護中心', '護理之家', '養護所', '安養所',
  '居家照顧服務中心', '居家服務中心',
]

function normalize(name: string): string {
  return name
    .replace(/\s/g, '')
    .replace(/Ａ-Ｚａ-ｚ０-９/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/台/g, '臺')
    .replace(/台/g, '臺')
}

function coreKeyword(name: string): string {
  let s = normalize(name)
  for (const w of STRIP_WORDS) s = s.replace(normalize(w), '')
  return s.replace(/[()（）、。]/g, '').trim()
}

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text)
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result)
  return String(v).trim()
}

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  // Try Excel numeric serial (days since 1900-01-01, with the leap-year bug)
  const n = parseInt(s)
  if (!isNaN(n) && n > 30000 && n < 60000) {
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + n * 86400000)
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

    // Auto-detect columns from header row
    const headerRow = sheet.getRow(1)
    const colIndex: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const h = cellStr(cell).trim()
      const field = HEADER_MAP[h]
      if (field) colIndex[field] = colNumber
    })

    if (!colIndex['name']) {
      return NextResponse.json({ error: 'Excel 找不到「機構名稱」欄位，請確認第一列為表頭' }, { status: 400 })
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

    // Get next code sequence
    const lastCustomer = await prisma.customer.findFirst({
      where: { code: { startsWith: 'C' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    let codeSeq = lastCustomer?.code ? (parseInt(lastCustomer.code.replace(/\D/g, '')) || 0) : 0

    const rows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row) })

    for (const row of rows) {
      const get = (field: string) => colIndex[field] ? cellStr(row.getCell(colIndex[field])) : ''

      const rawName = get('name').trim()
      if (!rawName) { results.skipped++; continue }

      try {
        // Build update payload — only include non-empty values
        const payload: Record<string, unknown> = {}

        const phone = get('phone'); if (phone) payload.phone = phone
        const fax   = get('fax');   if (fax)   payload.fax = fax
        const email = get('email'); if (email)  payload.email = email
        const city  = get('city');  if (city)   payload.city = city
        const address = get('address'); if (address) payload.address = address
        const contactPerson = get('contactPerson'); if (contactPerson) payload.contactPerson = contactPerson
        const district = get('district'); if (district) payload.district = district
        const notes = get('notes'); if (notes) payload.notes = notes
        const historyLog = get('historyLog'); if (historyLog) payload.historyLog = historyLog
        const currentBrand = get('currentBrand'); if (currentBrand) payload.currentBrand = currentBrand
        const carePopulation = get('carePopulation'); if (carePopulation) payload.carePopulation = carePopulation
        const quotationNotes = get('quotationNotes'); if (quotationNotes) payload.quotationNotes = quotationNotes
        const sampleProvided = get('sampleProvided'); if (sampleProvided) payload.sampleProvided = sampleProvided
        const collectionMethod = get('collectionMethod'); if (collectionMethod) payload.collectionMethod = collectionMethod
        const billingNotes = get('billingNotes'); if (billingNotes) payload.billingNotes = billingNotes
        const assignedSalesName = get('assignedSalesName'); if (assignedSalesName) payload.assignedSalesName = assignedSalesName
        const competitorShareholders = get('competitorShareholders'); if (competitorShareholders) payload.competitorShareholders = competitorShareholders
        const contactResultLatest = get('contactResultLatest'); if (contactResultLatest) payload.contactResultLatest = contactResultLatest
        const ltcStage = get('ltcStage'); if (ltcStage) payload.ltcStage = ltcStage

        const bedCountRaw = get('bedCount')
        if (bedCountRaw) { const n = parseInt(bedCountRaw); if (!isNaN(n)) payload.bedCount = n }

        const statusScoreRaw = get('statusScore')
        if (statusScoreRaw) { const n = parseInt(statusScoreRaw); if (!isNaN(n)) payload.healthScore = n }

        const monthlyCountRaw = get('monthlyContactCount')
        if (monthlyCountRaw) { const n = parseInt(monthlyCountRaw); if (!isNaN(n)) payload.monthlyContactCount = n }

        const regionRaw = get('region') || city || ''
        const mappedRegion = REGION_MAP[regionRaw] ?? REGION_MAP[regionRaw.replace(/市$|縣$/, '')] ?? null
        if (mappedRegion) payload.region = mappedRegion

        const lastContactedAt = parseDate(get('lastContactedAt'))
        if (lastContactedAt) payload.lastContactDate = lastContactedAt

        const firstVisitAt = parseDate(get('firstVisitAt'))
        if (firstVisitAt) payload.firstVisitAt = firstVisitAt

        const nextFollowUpAt = parseDate(get('nextFollowUpAt'))
        if (nextFollowUpAt) payload.nextFollowUpDate = nextFollowUpAt

        const continueFollowingRaw = get('continueFollowing')
        if (continueFollowingRaw) {
          payload.isFollowUp = ['是', 'Y', 'y', 'true', '1'].includes(continueFollowingRaw)
        }

        // Match: 1) exact name (case-insensitive) → 2) normalized core keyword
        let existing = await prisma.customer.findFirst({
          where: { name: { equals: rawName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!existing) {
          const core = coreKeyword(rawName)
          if (core.length >= 3) {
            existing = await prisma.customer.findFirst({
              where: { name: { contains: core, mode: 'insensitive' } },
              select: { id: true },
            })
          }
        }

        if (existing) {
          await prisma.customer.update({ where: { id: existing.id }, data: payload })
          results.updated++
        } else {
          codeSeq++
          await prisma.customer.create({
            data: {
              code: `C${String(codeSeq).padStart(5, '0')}`,
              name: rawName,
              type: 'NURSING_HOME',
              devStatus: 'POTENTIAL',
              ...payload,
            },
          })
          results.created++
        }
      } catch (err) {
        results.errors.push(`${rawName}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return handleApiError(error, 'customers.ltc-import')
  }
}
