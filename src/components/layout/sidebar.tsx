'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Truck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PieChart,
  UserCog,
  ShoppingBag,
  Building2,
  Warehouse,
  Navigation,
  ListTodo,
  HeartHandshake,
  CalendarDays,
  CalendarRange,
  Factory,
  Ship,
  Store,
  CreditCard,
  Target,
  ClipboardCheck,
  Layers,
  Crosshair,
  AlertOctagon,
  Shield,
  ShieldAlert,
  SearchCode,
  BadgeAlert,
  Calculator,
  Receipt,
  BookOpen,
  FileArchive,
  Landmark,
  Briefcase,
  Star,
  Zap,
  PackageCheck,
  PackageX,
  GitPullRequestArrow,
  ShipIcon,
  UserSquare2,
  ClipboardList,
  MapPinned,
  ReceiptText,
  BriefcaseBusiness,
  HandCoins,
  Megaphone,
  Network,
  Wallet,
  Scale,
  RotateCcw,
  CalendarCheck2,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'

type NavKey = 'dashboard' | 'dailyReport' | 'crm' | 'quickInput' | 'customers' | 'keyAccounts' | 'products' | 'quotations' | 'orders' | 'salesInvoices' | 'eInvoices' |
  'salesReturns' | 'purchaseReturns' |
  'shipments' | 'pickup' | 'picking' | 'dispatch' | 'logistics' | 'inventory' | 'warehouses' | 'wms' | 'purchases' | 'purchaseRequests' | 'rfq' | 'suppliers' |
  'production' | 'materialRequisitions' | 'productionReceipts' | 'seaFreight' | 'channels' | 'payments' | 'kpi' | 'pipeline' | 'opportunities' |
  'qc' | 'packaging' |
  'tasks' | 'care' | 'calendar' | 'businessCalendar' | 'reports' | 'users' | 'settings' | 'incidents' |
  'alerts' | 'traceability' | 'expiryTracking' | 'arAging' | 'apAging' | 'priceTiers' | 'stockCounts' | 'internalUse' | 'approvals' | 'importProjects' | 'contracts' | 'afterSales' | 'fixedAssets' | 'budget' | 'finance' | 'marginCalc' | 'profit' | 'knowledge' | 'retail' | 'auditLog' | 'documents' |
  'expenses' | 'hr' | 'orgChart' | 'announcements' | 'assetLoans' | 'purchasePlans' | 'discountRules' | 'regionMapping' |
  'creditManagement' | 'autoJournal' | 'statements' | 'inventoryMovement' |
  'generalLedger' | 'accountDetail' | 'accountSummary' | 'accountMovement' |
  'vatLedger' | 'cashBook' | 'dailyMonthlySummary' | 'periodClose' | 'bankAccounts' | 'cheques' | 'vatFilings' |
  'forexLedger' | 'vendorLedger1' | 'vendorLedger2' | 'partyTransactions' |
  'cashFlowStatement' | 'costDetail' | 'accountList' | 'incomeExpenseDetail' | 'retainedEarnings' |
  'dailyCashReport' | 'cashMovement' | 'cashPosition' | 'cashInoutDetail' |
  'monthlyPL' | 'monthlyCost' | 'arApTurnover' | 'managementSummary' | 'accountingSummary' |
  'monthlyPurchase' | 'monthlySales' | 'paymentSummary' | 'receiptSummary' | 'advancePaymentSummary' | 'customReport' |
  'transactionDetail' | 'arVoucherDetail' | 'apVoucherDetail' | 'paymentTransferList' |
  'groupDaily' | 'groupSales' | 'groupInventory' | 'groupLogistics' | 'groupProduction' | 'groupFinance' | 'groupService' | 'groupSystem' | 'groupHR' | 'groupAdmin'

type NavItem = { href: string; key: Exclude<NavKey, 'groupDaily' | 'groupSales' | 'groupInventory' | 'groupLogistics' | 'groupProduction' | 'groupFinance' | 'groupService' | 'groupSystem'>; icon: LucideIcon }
type NavGroup = { labelKey: NavKey; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    labelKey: 'groupDaily',
    items: [
      { href: '/dashboard',    key: 'dashboard',   icon: LayoutDashboard },
      { href: '/daily-report', key: 'dailyReport', icon: ClipboardCheck },
      { href: '/quick-input',  key: 'quickInput',  icon: Zap },
      { href: '/crm',          key: 'crm',         icon: Crosshair },
      { href: '/alerts',       key: 'alerts',      icon: ShieldAlert },
      { href: '/calendar',          key: 'calendar',         icon: CalendarDays },
      { href: '/business-calendar', key: 'businessCalendar',  icon: CalendarRange },
    ],
  },
  {
    labelKey: 'groupSales',
    items: [
      { href: '/customers',    key: 'customers',   icon: Users },
      { href: '/key-accounts', key: 'keyAccounts', icon: Star },
      { href: '/incidents',    key: 'incidents',   icon: AlertOctagon },
      { href: '/quotations',   key: 'quotations',  icon: FileText },
      { href: '/orders',          key: 'orders',         icon: ShoppingCart },
      { href: '/sales-invoices', key: 'salesInvoices',  icon: Receipt },
      { href: '/e-invoices',     key: 'eInvoices',      icon: FileText },
      { href: '/sales-returns',  key: 'salesReturns',   icon: RotateCcw },
      { href: '/margin-calc',    key: 'marginCalc',     icon: Calculator },
      { href: '/profit',         key: 'profit',         icon: TrendingUp },
      { href: '/kpi',                 key: 'kpi',            icon: Zap },
      { href: '/pipeline',            key: 'pipeline',       icon: Target },
      { href: '/sales-opportunities', key: 'opportunities',  icon: Briefcase },
      { href: '/tasks',               key: 'tasks',          icon: ListTodo },
    ],
  },
  {
    labelKey: 'groupInventory',
    items: [
      { href: '/products',      key: 'products',    icon: Package },
      { href: '/inventory',     key: 'inventory',   icon: BarChart3 },
      { href: '/warehouses',    key: 'warehouses',  icon: Warehouse },
      { href: '/stock-counts',  key: 'stockCounts',  icon: ClipboardCheck },
      { href: '/internal-use',  key: 'internalUse',  icon: PackageX },
      { href: '/traceability',     key: 'traceability',   icon: SearchCode },
      { href: '/expiry-tracking',   key: 'expiryTracking',   icon: Clock },
      { href: '/inventory-movement', key: 'inventoryMovement', icon: BarChart3 },
      { href: '/wms',           key: 'wms',          icon: Warehouse },
    ],
  },
  {
    labelKey: 'groupLogistics',
    items: [
      { href: '/shipments',    key: 'shipments',   icon: Truck },
      { href: '/picking',      key: 'picking',     icon: ClipboardCheck },
      { href: '/dispatch',     key: 'dispatch',    icon: Truck },
      { href: '/pickup',       key: 'pickup',      icon: Package },
      { href: '/logistics',    key: 'logistics',   icon: Navigation },
    ],
  },
  {
    labelKey: 'groupProduction',
    items: [
      { href: '/purchases',            key: 'purchases',           icon: ShoppingBag },
      { href: '/purchase-requests',     key: 'purchaseRequests',    icon: FileText },
      { href: '/rfq',                   key: 'rfq',                 icon: FileText },
      { href: '/suppliers',             key: 'suppliers',            icon: Building2 },
      { href: '/production',            key: 'production',           icon: Factory },
      { href: '/material-requisitions', key: 'materialRequisitions', icon: Layers },
      { href: '/production-receipts',   key: 'productionReceipts',   icon: PackageCheck },
      { href: '/qc',           key: 'qc',          icon: ClipboardCheck },
      { href: '/packaging',    key: 'packaging',   icon: Layers },
      { href: '/sea-freight',      key: 'seaFreight',     icon: Ship },
      { href: '/import-projects',  key: 'importProjects', icon: ShipIcon },
      { href: '/purchase-plans',   key: 'purchasePlans',  icon: ClipboardList },
      { href: '/purchase-returns', key: 'purchaseReturns', icon: RotateCcw },
    ],
  },
  {
    labelKey: 'groupFinance',
    items: [
      { href: '/contracts',          key: 'contracts',        icon: FileArchive },
      { href: '/credit-management', key: 'creditManagement', icon: BadgeAlert },
      { href: '/auto-journal',      key: 'autoJournal',     icon: Zap },
      { href: '/statements',        key: 'statements',      icon: FileText },
      { href: '/fixed-assets',    key: 'fixedAssets',    icon: Landmark },
      { href: '/budget',          key: 'budget',         icon: Target },
      { href: '/expenses',        key: 'expenses',       icon: ReceiptText },
      { href: '/finance',                    key: 'finance',         icon: BarChart3 },
      { href: '/finance/general-ledger',     key: 'generalLedger',   icon: BookOpen },
      { href: '/finance/account-detail',     key: 'accountDetail',   icon: BookOpen },
      { href: '/finance/account-summary',    key: 'accountSummary',  icon: BookOpen },
      { href: '/finance/account-movement',       key: 'accountMovement',      icon: BookOpen },
      { href: '/period-close',                   key: 'periodClose',          icon: CalendarCheck2 },
      { href: '/bank-accounts',                  key: 'bankAccounts',         icon: Landmark },
      { href: '/cheques',                        key: 'cheques',              icon: FileText },
      { href: '/vat-filings',                    key: 'vatFilings',           icon: Receipt },
      { href: '/finance/vat-ledger',             key: 'vatLedger',            icon: Receipt },
      { href: '/finance/cash-book',              key: 'cashBook',             icon: CreditCard },
      { href: '/finance/daily-monthly-summary',  key: 'dailyMonthlySummary',  icon: CalendarDays },
      { href: '/finance/forex-ledger',           key: 'forexLedger',          icon: BookOpen },
      { href: '/finance/vendor-ledger-1',        key: 'vendorLedger1',        icon: Users },
      { href: '/finance/vendor-ledger-2',        key: 'vendorLedger2',        icon: Building2 },
      { href: '/finance/party-transactions',     key: 'partyTransactions',    icon: BookOpen },
      { href: '/finance/cash-flow-statement',    key: 'cashFlowStatement',    icon: BarChart3 },
      { href: '/finance/cost-detail',            key: 'costDetail',           icon: Receipt },
      { href: '/finance/account-list',           key: 'accountList',          icon: BookOpen },
      { href: '/finance/income-expense-detail',  key: 'incomeExpenseDetail',  icon: BarChart3 },
      { href: '/finance/retained-earnings',      key: 'retainedEarnings',     icon: Landmark },
      { href: '/finance/daily-cash-report',      key: 'dailyCashReport',      icon: CalendarDays },
      { href: '/finance/cash-movement',          key: 'cashMovement',         icon: CreditCard },
      { href: '/finance/cash-position',          key: 'cashPosition',         icon: Wallet },
      { href: '/finance/cash-inout-detail',      key: 'cashInoutDetail',      icon: BarChart3 },
      { href: '/finance/monthly-pl',             key: 'monthlyPL',            icon: BarChart3 },
      { href: '/finance/monthly-cost',           key: 'monthlyCost',          icon: BarChart3 },
      { href: '/finance/ar-ap-turnover',         key: 'arApTurnover',         icon: BarChart3 },
      { href: '/finance/management-summary',     key: 'managementSummary',    icon: PieChart },
      { href: '/finance/accounting-summary',     key: 'accountingSummary',    icon: Scale },
      { href: '/finance/monthly-purchase',       key: 'monthlyPurchase',      icon: ShoppingBag },
      { href: '/finance/monthly-sales',          key: 'monthlySales',         icon: ShoppingCart },
      { href: '/finance/payment-summary',        key: 'paymentSummary',       icon: CreditCard },
      { href: '/finance/receipt-summary',        key: 'receiptSummary',       icon: Receipt },
      { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
      { href: '/finance/custom-report',          key: 'customReport',         icon: FileText },
      { href: '/finance/transaction-detail',     key: 'transactionDetail',    icon: BookOpen },
      { href: '/finance/ar-voucher-detail',      key: 'arVoucherDetail',      icon: Receipt },
      { href: '/finance/ap-voucher-detail',      key: 'apVoucherDetail',      icon: Receipt },
      { href: '/finance/payment-transfer-list',  key: 'paymentTransferList',  icon: CreditCard },
      { href: '/channels',        key: 'channels',       icon: Store },
      { href: '/retail',          key: 'retail',         icon: Landmark },
      { href: '/payments',        key: 'payments',       icon: CreditCard },
      { href: '/ar-aging',        key: 'arAging',        icon: Receipt },
      { href: '/ap-aging',        key: 'apAging',        icon: Receipt },
      { href: '/price-tiers',     key: 'priceTiers',     icon: Layers },
      { href: '/discount-rules',  key: 'discountRules',  icon: HandCoins },
    ],
  },
  {
    labelKey: 'groupService',
    items: [
      { href: '/after-sales',  key: 'afterSales',  icon: HeartHandshake },
      { href: '/care',         key: 'care',        icon: HeartHandshake },
      { href: '/knowledge',    key: 'knowledge',   icon: BookOpen },
    ],
  },
  {
    labelKey: 'groupHR',
    items: [
      { href: '/hr',           key: 'hr',          icon: UserSquare2 },
      { href: '/org-chart',    key: 'orgChart',    icon: Network },
    ],
  },
  {
    labelKey: 'groupAdmin',
    items: [
      { href: '/announcements', key: 'announcements', icon: Megaphone },
      { href: '/asset-loans',   key: 'assetLoans',    icon: BriefcaseBusiness },
      { href: '/region-mapping', key: 'regionMapping', icon: MapPinned },
    ],
  },
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/approvals',    key: 'approvals',   icon: GitPullRequestArrow },
      { href: '/reports',      key: 'reports',     icon: PieChart },
      { href: '/documents',    key: 'documents',   icon: FileArchive },
      { href: '/audit-log',    key: 'auditLog',    icon: Shield },
      { href: '/users',        key: 'users',       icon: UserCog },
      { href: '/settings',     key: 'settings',    icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const { dict } = useI18n()

  // Load user's allowed modules
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => setAllowedModules(d.allowedModules ?? ['*']))
      .catch(() => setAllowedModules(['*']))
  }, [])

  // Filter nav groups based on permissions
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      label: dict.nav[group.labelKey] as string,
      items: group.items.filter(item =>
        !allowedModules || allowedModules.includes('*') || allowedModules.includes(item.key)
      ),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-slate-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <span className="text-sm font-bold">C+</span>
        </div>
        {!collapsed && (
          <span className="ml-3 text-sm font-semibold whitespace-nowrap overflow-hidden">
            {dict.login.appName}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2">
        {filteredGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
            {/* Section label */}
            {!collapsed && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-1.5 mt-1.5 border-t border-slate-700" />
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, key, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                const label = dict.nav[key]
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-red-600/20 hover:text-red-400',
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>{dict.header.logout}</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  )
}
