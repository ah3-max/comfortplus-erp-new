import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// All sidebar module codes (keep in sync with sidebar.tsx navGroups)
const ALL_MODULES = [
  // Daily
  'dashboard', 'dailyReport', 'quickInput', 'crm', 'alerts', 'calendar', 'businessCalendar',
  // Sales
  'customers', 'keyAccounts', 'incidents', 'quotations', 'orders', 'salesInvoices', 'eInvoices',
  'marginCalc', 'kpi', 'pipeline', 'opportunities', 'tasks',
  // Inventory
  'products', 'inventory', 'warehouses', 'stockCounts', 'internalUse', 'traceability', 'wms',
  // Logistics
  'shipments', 'picking', 'dispatch', 'pickup', 'logistics',
  // Production & Procurement
  'purchases', 'purchaseRequests', 'rfq', 'suppliers', 'production', 'materialRequisitions',
  'productionReceipts', 'qc', 'packaging', 'seaFreight', 'importProjects', 'purchasePlans',
  // Finance
  'contracts', 'fixedAssets', 'budget', 'expenses', 'finance', 'channels', 'retail',
  'payments', 'arAging', 'apAging', 'priceTiers', 'discountRules',
  'generalLedger', 'accountDetail', 'accountSummary', 'accountMovement',
  'vatLedger', 'cashBook', 'dailyMonthlySummary', 'vendorLedger1', 'vendorLedger2',
  'partyTransactions', 'cashFlowStatement', 'costDetail', 'incomeExpenseDetail',
  'dailyCashReport', 'cashPosition', 'monthlyPL', 'monthlyCost', 'arApTurnover',
  'managementSummary', 'monthlyPurchase', 'monthlySales', 'paymentSummary', 'receiptSummary',
  'transactionDetail', 'arVoucherDetail', 'apVoucherDetail',
  // Service
  'afterSales', 'care', 'knowledge',
  // HR
  'hr', 'orgChart',
  // Admin
  'announcements', 'assetLoans', 'regionMapping',
  // System
  'approvals', 'reports', 'documents', 'auditLog', 'users', 'settings',
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
    'dashboard', 'dailyReport', 'quickInput', 'crm', 'alerts', 'calendar', 'businessCalendar',
    'customers', 'keyAccounts', 'incidents', 'quotations', 'orders', 'salesInvoices', 'eInvoices',
    'marginCalc', 'kpi', 'pipeline', 'opportunities', 'tasks',
    'products', 'inventory', 'shipments', 'pickup',
    'channels', 'payments', 'arAging', 'budget', 'expenses', 'contracts',
    'afterSales', 'care', 'knowledge',
    'approvals', 'reports', 'documents', 'announcements',
  ],
  SALES: [
    'dashboard', 'dailyReport', 'quickInput', 'crm', 'calendar',
    'customers', 'keyAccounts', 'quotations', 'orders', 'salesInvoices',
    'kpi', 'pipeline', 'opportunities', 'tasks',
    'products', 'shipments', 'pickup',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  CARE_SUPERVISOR: [
    'dashboard', 'calendar', 'businessCalendar', 'crm', 'alerts',
    'customers', 'keyAccounts', 'incidents', 'tasks',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  ECOMMERCE: [
    'dashboard', 'dailyReport',
    'orders', 'salesInvoices', 'eInvoices', 'kpi',
    'products', 'inventory',
    'shipments',
    'channels', 'retail', 'payments', 'arAging',
    'afterSales',
    'reports', 'announcements',
  ],
  CS: [
    'dashboard', 'crm', 'calendar',
    'customers', 'orders', 'tasks',
    'afterSales', 'care', 'knowledge',
    'approvals', 'announcements',
  ],
  WAREHOUSE_MANAGER: [
    'dashboard', 'quickInput', 'alerts',
    'orders', 'salesInvoices',
    'products', 'inventory', 'warehouses', 'stockCounts', 'internalUse', 'traceability', 'wms',
    'shipments', 'picking', 'dispatch', 'pickup', 'logistics',
    'purchases', 'purchaseRequests', 'suppliers', 'qc', 'packaging', 'seaFreight',
    'importProjects', 'purchasePlans',
    'reports', 'documents', 'announcements',
  ],
  WAREHOUSE: [
    'dashboard', 'quickInput',
    'inventory', 'warehouses', 'stockCounts', 'wms',
    'shipments', 'picking', 'dispatch', 'pickup', 'logistics', 'packaging',
    'announcements',
  ],
  PROCUREMENT: [
    'dashboard', 'alerts',
    'products', 'inventory', 'warehouses',
    'purchases', 'purchaseRequests', 'rfq', 'suppliers', 'production',
    'materialRequisitions', 'productionReceipts', 'qc', 'packaging',
    'seaFreight', 'importProjects', 'purchasePlans',
    'payments', 'apAging', 'budget',
    'reports', 'documents', 'announcements',
  ],
  FINANCE: [
    'dashboard',
    'orders', 'salesInvoices', 'eInvoices',
    'products',
    'contracts', 'fixedAssets', 'budget', 'expenses', 'finance',
    'channels', 'retail', 'payments', 'arAging', 'apAging', 'priceTiers', 'discountRules',
    'generalLedger', 'accountDetail', 'accountSummary', 'accountMovement',
    'vatLedger', 'cashBook', 'dailyMonthlySummary', 'vendorLedger1', 'vendorLedger2',
    'partyTransactions', 'cashFlowStatement', 'costDetail', 'incomeExpenseDetail',
    'dailyCashReport', 'cashPosition', 'monthlyPL', 'monthlyCost', 'arApTurnover',
    'managementSummary', 'monthlyPurchase', 'monthlySales', 'paymentSummary', 'receiptSummary',
    'transactionDetail', 'arVoucherDetail', 'apVoucherDetail',
    'approvals', 'reports', 'documents', 'auditLog', 'announcements',
  ],
}

// GET /api/role-permissions — returns full matrix { [role]: { [module]: boolean } }
export async function GET(_req: NextRequest) {
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
}

// PUT /api/role-permissions — bulk upsert { [role]: { [module]: boolean } }
export async function PUT(req: NextRequest) {
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
}
