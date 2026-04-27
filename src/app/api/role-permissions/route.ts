import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'
import { logAudit } from '@/lib/audit'

// All sidebar module codes (keep in sync with sidebar.tsx navGroups)
const ALL_MODULES = [
  // Daily
  'dashboard', 'dailyReminder', 'crm', 'institutionTours', 'calendar',
  // Sales — Customers
  'customers', 'keyAccounts', 'incidents',
  // Sales — Pipeline
  'pipeline', 'kpi', 'tasks', 'salesDailyReport', 'meetingRecords',
  // Sales — Transactions
  'quotations', 'orders', 'salesInvoices', 'eInvoices', 'salesReturns', 'channelOrders',
  // Inventory
  'products', 'inventory', 'inventorySafety', 'wms', 'stockCounts', 'internalUse', 'inbound',
  // Logistics
  'shippingCenter', 'shipments', 'picking', 'dispatch', 'logistics',
  // Procurement
  'purchases', 'purchaseRequests', 'suppliers', 'purchaseReturns', 'seaFreight',
  // Manufacturing
  'production', 'materialRequisitions', 'productionReceipts', 'qc',
  // Finance — Core
  'finance', 'payments', 'receipts', 'expenses', 'pettyCash',
  // Finance — AR/AP
  'accountsReceivable', 'accountsPayable', 'arAging', 'apAging', 'disbursements', 'creditManagement',
  // Finance — Ledgers
  'generalLedger', 'accountDetail', 'cashBook', 'vatLedger',
  // Finance — Reports
  'monthlyPL', 'cashFlowStatement', 'paymentSummary', 'receiptSummary', 'advancePaymentSummary', 'managementSummary',
  // Finance — Settings & extras
  'bankAccounts', 'bankReconcile', 'cheques', 'vatFilings', 'vatSummary', 'inputTax', 'periodClose', 'autoJournal',
  'settlement', 'customerPricing',
  // Channels
  'channels', 'priceTiers', 'discountRules', 'expenseCategories',
  // Analysis — Sales
  'reports', 'salesAnalysis', 'grossMargin', 'salespersonPerformance', 'competitorPrices',
  // Analysis — Ops
  'purchaseAnalysis', 'supplierPerformance', 'deliveryPerformance', 'inventoryMovement', 'deadStock',
  // Service
  'afterSales',
  // Admin
  'orgChart', 'announcements', 'regionMapping',
  // System
  'approvals', 'documents', 'warehouses', 'auditLog', 'users', 'settings', 'migration',
]

const ALL_ROLES = [
  'SUPER_ADMIN', 'GM', 'SALES_MANAGER', 'SALES', 'CARE_SUPERVISOR',
  'ECOMMERCE', 'CS', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'PROCUREMENT', 'FINANCE',
]

// Default: which modules each role can see by default
const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_MODULES,
  GM: ALL_MODULES,
  SALES_MANAGER: [
    'dashboard', 'dailyReminder', 'crm', 'institutionTours', 'calendar',
    'customers', 'keyAccounts', 'incidents',
    'pipeline', 'kpi', 'tasks', 'salesDailyReport', 'meetingRecords',
    'quotations', 'orders', 'salesInvoices', 'eInvoices', 'salesReturns', 'channelOrders',
    'products', 'inventory', 'shipments',
    'channels', 'payments', 'arAging', 'expenses',
    'salesAnalysis', 'grossMargin', 'salespersonPerformance', 'competitorPrices',
    'afterSales',
    'approvals', 'reports', 'documents', 'announcements',
  ],
  SALES: [
    'dashboard', 'customers', 'quotations', 'orders', 'crm',
    'salesDailyReport',
  ],
  CARE_SUPERVISOR: [
    'dashboard', 'dailyReminder', 'crm', 'institutionTours', 'calendar',
    'customers', 'keyAccounts', 'incidents', 'tasks',
    'afterSales',
    'approvals', 'announcements',
  ],
  ECOMMERCE: [
    'dashboard',
    'orders', 'salesInvoices', 'eInvoices', 'channelOrders', 'kpi',
    'products', 'inventory',
    'shippingCenter', 'shipments',
    'channels', 'priceTiers', 'payments', 'arAging',
    'salesAnalysis', 'afterSales',
    'reports', 'announcements',
  ],
  CS: [
    'dashboard', 'crm', 'calendar',
    'customers', 'orders', 'tasks',
    'afterSales',
    'approvals', 'announcements',
  ],
  WAREHOUSE_MANAGER: [
    'dashboard',
    'orders', 'salesInvoices',
    'products', 'inventory', 'inventorySafety', 'wms', 'stockCounts', 'internalUse', 'inbound',
    'shippingCenter', 'shipments', 'picking', 'dispatch', 'logistics',
    'purchases', 'purchaseRequests', 'suppliers', 'qc', 'seaFreight',
    'reports', 'documents', 'announcements',
  ],
  WAREHOUSE: [
    'dashboard',
    'inventory', 'inventorySafety', 'wms', 'stockCounts', 'inbound',
    'shippingCenter', 'shipments', 'picking', 'dispatch', 'logistics',
    'announcements',
  ],
  PROCUREMENT: [
    'dashboard',
    'products', 'inventory', 'inventorySafety',
    'purchases', 'purchaseRequests', 'suppliers', 'purchaseReturns',
    'production', 'materialRequisitions', 'productionReceipts', 'qc',
    'seaFreight',
    'payments', 'apAging', 'disbursements',
    'purchaseAnalysis', 'supplierPerformance',
    'reports', 'documents', 'announcements',
  ],
  FINANCE: [
    'dashboard', 'announcements',
    // AR
    'orders', 'salesInvoices', 'salesReturns', 'eInvoices',
    'accountsReceivable', 'receipts', 'arAging', 'settlement', 'creditManagement',
    // AP
    'accountsPayable', 'payments', 'apAging', 'disbursements',
    'expenses', 'pettyCash',
    // Bank
    'bankAccounts', 'bankReconcile', 'cheques', 'cashBook',
    // Ledger
    'generalLedger', 'accountDetail', 'vatLedger',
    'inputTax', 'vatSummary', 'vatFilings',
    // Finance dashboard
    'finance',
    // Reports
    'monthlyPL', 'cashFlowStatement', 'paymentSummary', 'receiptSummary', 'advancePaymentSummary', 'managementSummary',
    'grossMargin', 'salesAnalysis', 'reports',
    // Period close
    'autoJournal', 'periodClose',
    // Channels & pricing
    'channels', 'priceTiers', 'discountRules', 'customerPricing',
    // Products (read for AR verification)
    'products',
    // System
    'approvals', 'documents', 'auditLog',
  ],
}

// GET /api/role-permissions — returns full matrix { [role]: { [module]: boolean } }
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.rolePermission.findMany({
      select: { roleName: true, module: true, canView: true },
    })

    // Build matrix: if no record exists for a role+module, use default
    const matrix: Record<string, Record<string, boolean>> = {}
    for (const role of ALL_ROLES) {
      matrix[role] = {}
      const defaults = ROLE_DEFAULTS[role] ?? []
      for (const mod of ALL_MODULES) {
        const record = existing.find(r => r.roleName === role && r.module === mod)
        matrix[role][mod] = record ? record.canView : defaults.includes(mod)
      }
    }

    return NextResponse.json({ matrix, roles: ALL_ROLES, modules: ALL_MODULES })
  } catch (error) {
    return handleApiError(error, 'role-permissions.GET')
  }
}

// PUT /api/role-permissions — bulk upsert { [role]: { [module]: boolean } }
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check admin
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'GM') {
      return NextResponse.json({ error: '僅管理員可修改權限' }, { status: 403 })
    }

    const { matrix } = await req.json() as { matrix: Record<string, Record<string, boolean>> }

    // Count changes against existing DB state for audit
    const existingPerms = await prisma.rolePermission.findMany({
      select: { roleName: true, module: true, canView: true },
    })
    const existingMap = new Map(existingPerms.map(p => [`${p.roleName}:${p.module}`, p.canView]))
    const diffs: { role: string; module: string; before: boolean | null; after: boolean }[] = []

    // Upsert all entries
    const ops = []
    for (const [role, modules] of Object.entries(matrix)) {
      for (const [mod, canView] of Object.entries(modules)) {
        const prev = existingMap.get(`${role}:${mod}`) ?? null
        if (prev !== canView) diffs.push({ role, module: mod, before: prev, after: canView })
        ops.push(
          prisma.rolePermission.upsert({
            where: { roleName_module: { roleName: role, module: mod } },
            create: { roleName: role, module: mod, canView },
            update: { canView },
          })
        )
      }
    }

    await prisma.$transaction(ops)

    if (diffs.length > 0) {
      const changesObj: Record<string, { before: unknown; after: unknown }> = {}
      for (const d of diffs.slice(0, 50)) {
        changesObj[`${d.role}.${d.module}`] = { before: d.before, after: d.after }
      }
      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? '',
        userRole: user.role,
        module: 'role-permissions',
        action: 'UPDATE',
        entityType: 'RolePermissionMatrix',
        entityId: 'global',
        entityLabel: `${diffs.length} 項權限變更`,
        changes: changesObj,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'role-permissions.PUT')
  }
}
