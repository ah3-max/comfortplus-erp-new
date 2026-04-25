/**
 * Seed: 東泓供應鏈 ProductVariant 種子資料
 * 3 個 Master SKU × 3 個產地 = 9 個 Variant
 * 執行: npm run seed:donghong
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma  = new PrismaClient({ adapter })

const DEFAULT_SPEC_LOCK = {
  sap_weight:   '住友 16g',
  film_material: '複合膜',
  absorption:   '45g±3%',
}

async function main() {
  console.log('🌱 開始 donghong-variants seed...')

  // ── 1. 清掉 Step 4 的 TEST- 測試資料 ──────────────────────────────────
  const testVariants = await prisma.productVariant.findMany({
    where: { masterSku: { startsWith: 'TEST-' } },
    select: { id: true },
  })
  if (testVariants.length > 0) {
    await prisma.variantBarcode.deleteMany({
      where: { variantId: { in: testVariants.map(v => v.id) } },
    })
    await prisma.productVariant.deleteMany({
      where: { masterSku: { startsWith: 'TEST-' } },
    })
    // 清掉對應的 Product（isMasterSku + masterSku starts with TEST-）
    await prisma.product.deleteMany({
      where: { isMasterSku: true, masterSku: { startsWith: 'TEST-' } },
    })
    console.log(`  🗑  清除 ${testVariants.length} 個 TEST- variant`)
  }

  // ── 2. Upsert Suppliers ───────────────────────────────────────────────
  const supplierDefs = [
    { code: 'SUP-TW-005', name: '富堡工業股份有限公司',  country: 'TW' },
    { code: 'SUP-CN-002', name: '凱達（中國）衛生用品廠', country: 'CN' },
    { code: 'SUP-VN-004', name: '越南 XX 護理用品廠',    country: 'VN' },
    { code: 'SUP-TH-001', name: '泰國 OEM 衛生用品廠',   country: 'TH' },
  ]
  const supplierMap: Record<string, string> = {}

  for (const s of supplierDefs) {
    const sup = await prisma.supplier.upsert({
      where:  { code: s.code },
      update: { name: s.name },
      create: {
        code:    s.code,
        name:    s.name,
        donghongBusinessUnit: 'DONGHONG',
      },
    })
    supplierMap[s.country === 'TW' && s.code === 'SUP-TW-005' ? 'TW_FB'
              : s.country === 'CN' ? 'CN_KD'
              : s.country === 'VN' ? 'VN_XX'
              : 'TH_OEM'] = sup.id
    console.log(`  ✓ Supplier ${s.code} ${s.name}`)
  }

  // ── 3. Master SKU 定義 ────────────────────────────────────────────────
  const masters = [
    {
      masterSku: 'CP-I-Night',
      name:      '舒適加夜用成人紙尿褲',
      category:  'DIAPER',
      defaultVariantOrigin: 'CN_KD',
      variants: [
        { originCode: 'TW_FB', countryOrigin: 'TW', barcode: '4711001000000' },
        { originCode: 'CN_KD', countryOrigin: 'CN', barcode: '6901001000003' },
        { originCode: 'VN_XX', countryOrigin: 'VN', barcode: '8931001000008' },
      ],
    },
    {
      masterSku: 'CP-I-Day',
      name:      '舒適加日用成人紙尿褲',
      category:  'DIAPER',
      defaultVariantOrigin: 'CN_KD',
      variants: [
        { originCode: 'TW_FB', countryOrigin: 'TW', barcode: '4711002000009' },
        { originCode: 'CN_KD', countryOrigin: 'CN', barcode: '6901002000002' },
        { originCode: 'VN_XX', countryOrigin: 'VN', barcode: '8931002000007' },
      ],
    },
    {
      masterSku: 'CP-W-Wipes',
      name:      '舒適加濕紙巾',
      category:  'WIPES',
      defaultVariantOrigin: 'TW_FB',
      variants: [
        { originCode: 'TW_FB',  countryOrigin: 'TW', barcode: '4711003000008' },
        { originCode: 'CN_KD',  countryOrigin: 'CN', barcode: '6901003000001' },
        { originCode: 'TH_OEM', countryOrigin: 'TH', barcode: '8851003000007' },
      ],
    },
  ]

  // ── 4. 建立 Master + Variants ─────────────────────────────────────────
  for (const m of masters) {
    // upsert Product（以 masterSku unique）
    const existingProduct = await prisma.product.findUnique({
      where: { masterSku: m.masterSku },
    })

    let product = existingProduct ?? await prisma.product.create({
      data: {
        sku:         m.masterSku,
        name:        m.name,
        category:    m.category,
        isMasterSku: true,
        masterSku:   m.masterSku,
        businessUnit: 'SHARED',
        costPrice:   0,
        sellingPrice: 0,
      },
    })

    const createdVariantIds: Record<string, string> = {}

    for (const v of m.variants) {
      const variantSku = `${m.masterSku}-${v.originCode}`
      const supplierId = supplierMap[v.originCode] ?? null

      // upsert Variant
      const variant = await prisma.productVariant.upsert({
        where:  { variantSku },
        update: {
          supplierId,
          defaultSpecLock: DEFAULT_SPEC_LOCK,
        },
        create: {
          masterSku:       m.masterSku,
          originCode:      v.originCode as 'TW_FB' | 'CN_KD' | 'VN_XX' | 'TH_OEM' | 'OTHER',
          variantSku,
          countryOrigin:   v.countryOrigin as 'TW' | 'CN' | 'VN' | 'TH' | 'JP' | 'OTHER',
          masterProductId: product.id,
          supplierId,
          businessUnit:    'DONGHONG',
          defaultSpecLock: DEFAULT_SPEC_LOCK,
        },
      })
      createdVariantIds[v.originCode] = variant.id

      // upsert Barcode
      await prisma.variantBarcode.upsert({
        where:  { barcodeEan13: v.barcode },
        update: {},
        create: {
          variantId:       variant.id,
          barcodeEan13:    v.barcode,
          barcodeType:     'SINGLE',
          quantityPerUnit: 1,
        },
      })

      console.log(`  ✓ ${variantSku}  barcode ${v.barcode}`)
    }

    // 更新 Product.defaultVariantId
    const defaultId = createdVariantIds[m.defaultVariantOrigin]
    if (defaultId && product.defaultVariantId !== defaultId) {
      product = await prisma.product.update({
        where: { id: product.id },
        data:  { defaultVariantId: defaultId },
      })
    }

    console.log(`  ★ ${m.masterSku}  defaultVariant=${m.defaultVariantOrigin}`)
  }

  console.log('\n✅ donghong-variants seed 完成')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
