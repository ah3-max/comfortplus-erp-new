import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

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
  'arAging', 'apAging', 'disbursements', 'creditManagement',
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
    'dashboard', 'finance',
    'receipts', 'payments', 'expenses',
    'arAging', 'apAging',
    'generalLedger', 'monthlyPL',
    'vatFilings', 'periodClose',
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

    // Upsert all entries
    const ops = []
    for (const [role, modules] of Object.entries(matrix)) {
      for (const [mod, canView] of Object.entries(modules)) {
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, 'role-permissions.PUT')
  }
}
