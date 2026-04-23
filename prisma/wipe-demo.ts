/**
 * prisma/wipe-demo.ts — 清空所有 demo 業務資料，保留設定。
 *
 * 跑法：
 *   npx tsx prisma/wipe-demo.ts --yes
 *
 * 會清掉：
 *   CRM：FollowUpLog, VisitRecord, CallRecord, SampleRecord, SalesSchedule,
 *        InstitutionTour, SalesTask, SalesOpportunity, Notification
 *   銷售：Quotation(+Item), SalesOrder(+Item), SalesInvoice(+Item),
 *         Shipment(+Item), PickingOrder(+Item), DispatchOrder(+Item),
 *         ReturnOrder(+Item), CreditDebitNote, AuditLog
 *   財務：ReceiptRecord, DisbursementRecord, PaymentRecord,
 *         AccountsReceivable, AccountsPayable, JournalEntry(+Line)
 *   客戶：Customer (本人建的全部)
 *   庫存：InventoryTransaction (動作紀錄，留 Inventory 餘額)
 *
 * 保留：
 *   User, RolePermission, Product, Warehouse, Supplier,
 *   AccountingAccount, FiscalPeriod, Inventory (餘額),
 *   SpecialPrice (客戶刪除時會連動 cascade)
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config() // load .env

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('⚠️  This will delete all demo business data. Re-run with --yes to confirm.')
    process.exit(1)
  }

  const tally: Record<string, number> = {}
  const track = async (name: string, fn: () => Promise<{ count: number }>) => {
    try {
      const r = await fn()
      tally[name] = r.count
      console.log(`  - ${name}: ${r.count}`)
    } catch (e) {
      console.log(`  ✗ ${name}: ${(e as Error).message}`)
    }
  }

  console.log('🗑️  Wiping demo data...\n')

  // CRM 活動紀錄
  console.log('CRM activities:')
  await track('FollowUpLog',      () => prisma.followUpLog.deleteMany())
  await track('VisitRecord',      () => prisma.visitRecord.deleteMany())
  await track('CallRecord',       () => prisma.callRecord.deleteMany())
  await track('SampleRecord',     () => prisma.sampleRecord.deleteMany())
  await track('SalesSchedule',    () => prisma.salesSchedule.deleteMany())
  await track('InstitutionTour',  () => prisma.institutionTour.deleteMany())
  await track('SalesTask',        () => prisma.salesTask.deleteMany())
  await track('SalesOpportunity', () => prisma.salesOpportunity.deleteMany())
  await track('SalesDailyReport', () => prisma.salesDailyReport.deleteMany())
  await track('Notification',     () => prisma.notification.deleteMany())

  // 出貨/配送
  console.log('\nLogistics:')
  await track('ShipmentItem',     () => prisma.shipmentItem.deleteMany())
  await track('Shipment',         () => prisma.shipment.deleteMany())
  await track('PickingOrderItem', () => prisma.pickingOrderItem.deleteMany())
  await track('PickingOrder',     () => prisma.pickingOrder.deleteMany())
  await track('DispatchOrderItem',() => prisma.dispatchOrderItem.deleteMany())
  await track('DispatchOrder',    () => prisma.dispatchOrder.deleteMany())

  // 退貨 + 貸項
  console.log('\nReturns:')
  await track('ReturnOrderItem',  () => prisma.returnOrderItem.deleteMany())
  await track('ReturnOrder',      () => prisma.returnOrder.deleteMany())
  await track('CreditDebitNote',  () => prisma.creditDebitNote.deleteMany())

  // 財務流水
  console.log('\nFinance:')
  await track('ReceiptRecord',       () => prisma.receiptRecord.deleteMany())
  await track('DisbursementRecord',  () => prisma.disbursementRecord.deleteMany())
  await track('PaymentRecord',       () => prisma.paymentRecord.deleteMany())
  await track('CollectionLog',       () => prisma.collectionLog.deleteMany())
  await track('SettlementItem',      () => prisma.settlementItem.deleteMany())
  await track('SettlementBatch',     () => prisma.settlementBatch.deleteMany())
  await track('AccountsReceivable',  () => prisma.accountsReceivable.deleteMany())
  await track('AccountsPayable',     () => prisma.accountsPayable.deleteMany())
  await track('SupplierInvoice',     () => prisma.supplierInvoice.deleteMany())
  await track('JournalEntryLine',    () => prisma.journalEntryLine.deleteMany())
  await track('JournalEntry',        () => prisma.journalEntry.deleteMany())

  // 銷貨發票 + 訂單 + 報價
  console.log('\nSales:')
  await track('SalesInvoiceItem',  () => prisma.salesInvoiceItem.deleteMany())
  await track('SalesInvoice',      () => prisma.salesInvoice.deleteMany())
  await track('SalesOrderItem',    () => prisma.salesOrderItem.deleteMany())
  await track('SalesOrder',        () => prisma.salesOrder.deleteMany())
  await track('QuotationItem',     () => prisma.quotationItem.deleteMany())
  await track('Quotation',         () => prisma.quotation.deleteMany())

  // 庫存動作（留餘額）
  console.log('\nInventory movements:')
  await track('InventoryTransaction', () => prisma.inventoryTransaction.deleteMany())

  // 客戶主檔
  console.log('\nCustomers:')
  await track('CustomerContact',   () => prisma.customerContact.deleteMany())
  await track('Customer',          () => prisma.customer.deleteMany())

  // 稽核（乾淨起點）
  console.log('\nAudit:')
  await track('AuditLog',          () => prisma.auditLog.deleteMany())

  // Totals
  const total = Object.values(tally).reduce((s, n) => s + n, 0)
  console.log(`\n✅ 清除完成，共 ${total} 筆記錄`)
  console.log('\n保留：User / Product / Supplier / Warehouse / RolePermission / AccountingAccount / Inventory(餘額) / SpecialPrice')
}

main()
  .catch(e => {
    console.error('❌ 錯誤:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
