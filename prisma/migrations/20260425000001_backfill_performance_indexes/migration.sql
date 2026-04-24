-- 補 commit a2e04c5 遺漏的 migrate
-- perf(db): 補 @@index 改善查詢效能
-- 7 張表共 19 個 index

-- AccountsPayable × 3
CREATE INDEX IF NOT EXISTS "AccountsPayable_supplierId_status_idx" ON "AccountsPayable"("supplierId", "status");
CREATE INDEX IF NOT EXISTS "AccountsPayable_supplierId_invoiceDate_idx" ON "AccountsPayable"("supplierId", "invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS "AccountsPayable_status_dueDate_idx" ON "AccountsPayable"("status", "dueDate");

-- AccountsReceivable × 3
CREATE INDEX IF NOT EXISTS "AccountsReceivable_customerId_status_idx" ON "AccountsReceivable"("customerId", "status");
CREATE INDEX IF NOT EXISTS "AccountsReceivable_customerId_invoiceDate_idx" ON "AccountsReceivable"("customerId", "invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS "AccountsReceivable_status_dueDate_idx" ON "AccountsReceivable"("status", "dueDate");

-- FollowUpLog × 2
CREATE INDEX IF NOT EXISTS "FollowUpLog_customerId_logDate_idx" ON "FollowUpLog"("customerId", "logDate" DESC);
CREATE INDEX IF NOT EXISTS "FollowUpLog_createdById_logDate_idx" ON "FollowUpLog"("createdById", "logDate" DESC);

-- PaymentRecord × 4
CREATE INDEX IF NOT EXISTS "PaymentRecord_customerId_direction_paymentDate_idx" ON "PaymentRecord"("customerId", "direction", "paymentDate" DESC);
CREATE INDEX IF NOT EXISTS "PaymentRecord_supplierId_direction_paymentDate_idx" ON "PaymentRecord"("supplierId", "direction", "paymentDate" DESC);
CREATE INDEX IF NOT EXISTS "PaymentRecord_salesOrderId_direction_idx" ON "PaymentRecord"("salesOrderId", "direction");
CREATE INDEX IF NOT EXISTS "PaymentRecord_purchaseOrderId_direction_idx" ON "PaymentRecord"("purchaseOrderId", "direction");

-- ReceiptRecord × 2
CREATE INDEX IF NOT EXISTS "ReceiptRecord_arId_idx" ON "ReceiptRecord"("arId");
CREATE INDEX IF NOT EXISTS "ReceiptRecord_customerId_receiptDate_idx" ON "ReceiptRecord"("customerId", "receiptDate" DESC);

-- ReturnOrder × 3
CREATE INDEX IF NOT EXISTS "ReturnOrder_customerId_status_idx" ON "ReturnOrder"("customerId", "status");
CREATE INDEX IF NOT EXISTS "ReturnOrder_status_createdAt_idx" ON "ReturnOrder"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ReturnOrder_orderId_idx" ON "ReturnOrder"("orderId");

-- SalesTask × 2
CREATE INDEX IF NOT EXISTS "SalesTask_assignedToId_status_dueDate_idx" ON "SalesTask"("assignedToId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "SalesTask_customerId_status_idx" ON "SalesTask"("customerId", "status");
