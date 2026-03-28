'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, Truck,
  BarChart3, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut,
  PieChart, UserCog, ShoppingBag, Building2, Warehouse, Navigation,
  ListTodo, HeartHandshake, CalendarDays, Factory, Ship, Store,
  CreditCard, Target, ClipboardCheck, Layers, Crosshair, AlertOctagon,
  Shield, ShieldAlert, SearchCode, BadgeAlert, Calculator, Receipt,
  BookOpen, FileArchive, Landmark, Briefcase, Star, Zap, PackageCheck,
  PackageX, GitPullRequestArrow, ShipIcon, UserSquare2, ClipboardList,
  MapPinned, ReceiptText, BriefcaseBusiness, HandCoins, Megaphone,
  Network, Wallet, Scale, RotateCcw, CalendarCheck2, TrendingUp,
  Clock, DollarSign, CheckCircle2, Tag,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */
type NavItem = { href: string; key: string; icon: LucideIcon }
type NavSubGroup = { subLabelKey: string; items: NavItem[] }
type NavGroupEntry = NavItem | NavSubGroup
type NavGroup = { labelKey: string; items: NavGroupEntry[] }

function isSubGroup(entry: NavGroupEntry): entry is NavSubGroup {
  return 'subLabelKey' in entry
}

/* ── Nav Structure ── */
const navGroups: NavGroup[] = [
  /* ─── 日常作業 ─── */
  {
    labelKey: 'groupDaily',
    items: [
      { href: '/dashboard',    key: 'dashboard',   icon: LayoutDashboard },
      { href: '/daily-report', key: 'dailyReport', icon: ClipboardCheck },
      { href: '/quick-input',  key: 'quickInput',  icon: Zap },
      { href: '/crm',          key: 'crm',         icon: Crosshair },
      { href: '/alerts',       key: 'alerts',      icon: ShieldAlert },
      { href: '/calendar',     key: 'calendar',    icon: CalendarDays },
    ],
  },

  /* ─── 銷售業務 ─── */
  {
    labelKey: 'groupSales',
    items: [
      {
        subLabelKey: 'subCustomers',
        items: [
          { href: '/customers',    key: 'customers',   icon: Users },
          { href: '/key-accounts', key: 'keyAccounts', icon: Star },
          { href: '/incidents',    key: 'incidents',   icon: AlertOctagon },
        ],
      },
      {
        subLabelKey: 'subOpportunity',
        items: [
          { href: '/pipeline',            key: 'pipeline',       icon: Target },
          { href: '/sales-opportunities', key: 'opportunities',  icon: Briefcase },
          { href: '/kpi',                 key: 'kpi',            icon: Zap },
          { href: '/tasks',               key: 'tasks',          icon: ListTodo },
          { href: '/meeting-records',     key: 'meetingRecords', icon: CalendarDays },
          { href: '/business-calendar',   key: 'businessCalendar', icon: CalendarDays },
          { href: '/promo-calendar',      key: 'promoCalendar',  icon: CalendarDays },
        ],
      },
      {
        subLabelKey: 'subTransaction',
        items: [
          { href: '/quotations',     key: 'quotations',    icon: FileText },
          { href: '/orders',         key: 'orders',        icon: ShoppingCart },
          { href: '/sales-invoices', key: 'salesInvoices', icon: Receipt },
          { href: '/e-invoices',     key: 'eInvoices',     icon: FileText },
          { href: '/sales-returns',  key: 'salesReturns',  icon: RotateCcw },
          { href: '/price-lists',    key: 'priceLists',    icon: Tag },
          { href: '/channel-orders', key: 'channelOrders', icon: ShoppingBag },
          { href: '/margin-calc',    key: 'marginCalc',    icon: Calculator },
          { href: '/profit',         key: 'profit',        icon: TrendingUp },
        ],
      },
    ],
  },

  /* ─── 商品庫存 ─── */
  {
    labelKey: 'groupInventory',
    items: [
      { href: '/products',       key: 'products',      icon: Package },
      { href: '/inventory',      key: 'inventory',     icon: BarChart3 },
      { href: '/warehouses',     key: 'warehouses',    icon: Warehouse },
      { href: '/wms',            key: 'wms',           icon: Warehouse },
      { href: '/stock-counts',   key: 'stockCounts',   icon: ClipboardCheck },
      { href: '/inventory-lots', key: 'inventoryLots', icon: Package },
      { href: '/defective-goods', key: 'defectiveGoods', icon: PackageX },
      { href: '/internal-use',   key: 'internalUse',   icon: PackageX },
    ],
  },

  /* ─── 出貨物流 ─── */
  {
    labelKey: 'groupLogistics',
    items: [
      { href: '/shipments',      key: 'shipments',      icon: Truck },
      { href: '/picking',        key: 'picking',        icon: ClipboardCheck },
      { href: '/dispatch',       key: 'dispatch',       icon: Truck },
      { href: '/pickup',         key: 'pickup',         icon: Package },
      { href: '/logistics',      key: 'logistics',      icon: Navigation },
      { href: '/vehicles',       key: 'vehicles',       icon: Truck },
      { href: '/delivery-trips', key: 'deliveryTrips',  icon: Truck },
    ],
  },

  /* ─── 採購生產 ─── */
  {
    labelKey: 'groupProduction',
    items: [
      {
        subLabelKey: 'subPurchasing',
        items: [
          { href: '/purchases',         key: 'purchases',        icon: ShoppingBag },
          { href: '/purchase-requests',  key: 'purchaseRequests', icon: FileText },
          { href: '/rfq',                key: 'rfq',              icon: FileText },
          { href: '/suppliers',          key: 'suppliers',        icon: Building2 },
          { href: '/purchase-plans',     key: 'purchasePlans',    icon: ClipboardList },
          { href: '/purchase-returns',   key: 'purchaseReturns',  icon: RotateCcw },
        ],
      },
      {
        subLabelKey: 'subManufacturing',
        items: [
          { href: '/production',            key: 'production',           icon: Factory },
          { href: '/material-requisitions', key: 'materialRequisitions', icon: Layers },
          { href: '/production-receipts',   key: 'productionReceipts',   icon: PackageCheck },
          { href: '/qc',                    key: 'qc',                   icon: ClipboardCheck },
          { href: '/packaging',             key: 'packaging',            icon: Layers },
        ],
      },
      {
        subLabelKey: 'subImport',
        items: [
          { href: '/sea-freight',     key: 'seaFreight',     icon: Ship },
          { href: '/import-projects', key: 'importProjects', icon: ShipIcon },
        ],
      },
    ],
  },

  /* ─── 財務會計 ─── */
  {
    labelKey: 'groupFinance',
    items: [
      {
        subLabelKey: 'subFinCore',
        items: [
          { href: '/finance',       key: 'finance',    icon: BarChart3 },
          { href: '/payments',      key: 'payments',   icon: CreditCard },
          { href: '/contracts',     key: 'contracts',  icon: FileArchive },
          { href: '/expenses',      key: 'expenses',   icon: ReceiptText },
          { href: '/fixed-assets',  key: 'fixedAssets', icon: Landmark },
          { href: '/budget',        key: 'budget',     icon: Target },
        ],
      },
      {
        subLabelKey: 'subArAp',
        items: [
          { href: '/ar-aging',          key: 'arAging',          icon: Receipt },
          { href: '/ap-aging',          key: 'apAging',          icon: Receipt },
          { href: '/credit-management', key: 'creditManagement', icon: BadgeAlert },
          { href: '/statements',        key: 'statements',       icon: FileText },
        ],
      },
      {
        subLabelKey: 'subLedgers',
        items: [
          { href: '/finance/general-ledger',    key: 'generalLedger',    icon: BookOpen },
          { href: '/finance/account-detail',    key: 'accountDetail',    icon: BookOpen },
          { href: '/finance/account-summary',   key: 'accountSummary',   icon: BookOpen },
          { href: '/finance/account-movement',  key: 'accountMovement',  icon: BookOpen },
          { href: '/finance/vat-ledger',        key: 'vatLedger',        icon: Receipt },
          { href: '/finance/cash-book',         key: 'cashBook',         icon: CreditCard },
          { href: '/finance/daily-monthly-summary', key: 'dailyMonthlySummary', icon: CalendarDays },
          { href: '/finance/forex-ledger',      key: 'forexLedger',      icon: BookOpen },
          { href: '/finance/vendor-ledger-1',   key: 'vendorLedger1',    icon: Users },
          { href: '/finance/vendor-ledger-2',   key: 'vendorLedger2',    icon: Building2 },
          { href: '/finance/party-transactions', key: 'partyTransactions', icon: BookOpen },
        ],
      },
      {
        subLabelKey: 'subFinReports',
        items: [
          { href: '/finance/cash-flow-statement',   key: 'cashFlowStatement',   icon: BarChart3 },
          { href: '/finance/cost-detail',           key: 'costDetail',           icon: Receipt },
          { href: '/finance/account-list',          key: 'accountList',          icon: BookOpen },
          { href: '/finance/income-expense-detail', key: 'incomeExpenseDetail',  icon: BarChart3 },
          { href: '/finance/retained-earnings',     key: 'retainedEarnings',     icon: Landmark },
        ],
      },
      {
        subLabelKey: 'subOperations',
        items: [
          { href: '/finance/daily-cash-report',  key: 'dailyCashReport',  icon: CalendarDays },
          { href: '/finance/cash-movement',      key: 'cashMovement',     icon: CreditCard },
          { href: '/finance/cash-position',      key: 'cashPosition',     icon: Wallet },
          { href: '/finance/cash-inout-detail',  key: 'cashInoutDetail',  icon: BarChart3 },
          { href: '/finance/monthly-pl',         key: 'monthlyPL',        icon: BarChart3 },
          { href: '/finance/monthly-cost',       key: 'monthlyCost',      icon: BarChart3 },
          { href: '/finance/ar-ap-turnover',     key: 'arApTurnover',     icon: BarChart3 },
          { href: '/finance/management-summary', key: 'managementSummary', icon: PieChart },
          { href: '/finance/accounting-summary', key: 'accountingSummary', icon: Scale },
          { href: '/finance/monthly-purchase',   key: 'monthlyPurchase',  icon: ShoppingBag },
          { href: '/finance/monthly-sales',      key: 'monthlySales',     icon: ShoppingCart },
          { href: '/finance/payment-summary',    key: 'paymentSummary',   icon: CreditCard },
          { href: '/finance/receipt-summary',    key: 'receiptSummary',   icon: Receipt },
          { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
          { href: '/finance/custom-report',      key: 'customReport',     icon: FileText },
        ],
      },
      {
        subLabelKey: 'subVouchers',
        items: [
          { href: '/finance/transaction-detail',    key: 'transactionDetail',   icon: BookOpen },
          { href: '/finance/ar-voucher-detail',     key: 'arVoucherDetail',     icon: Receipt },
          { href: '/finance/ap-voucher-detail',     key: 'apVoucherDetail',     icon: Receipt },
          { href: '/finance/payment-transfer-list', key: 'paymentTransferList', icon: CreditCard },
        ],
      },
      {
        subLabelKey: 'subFinSettings',
        items: [
          { href: '/auto-journal',  key: 'autoJournal', icon: Zap },
          { href: '/period-close',  key: 'periodClose', icon: CalendarCheck2 },
          { href: '/bank-accounts', key: 'bankAccounts', icon: Landmark },
          { href: '/cheques',       key: 'cheques',     icon: FileText },
          { href: '/vat-filings',   key: 'vatFilings',  icon: Receipt },
        ],
      },
      {
        subLabelKey: 'subChannels',
        items: [
          { href: '/channels',       key: 'channels',      icon: Store },
          { href: '/retail',         key: 'retail',        icon: Landmark },
          { href: '/price-tiers',    key: 'priceTiers',    icon: Layers },
          { href: '/discount-rules', key: 'discountRules', icon: HandCoins },
        ],
      },
    ],
  },

  /* ─── 分析報表 ─── */
  {
    labelKey: 'groupAnalysis',
    items: [
      { href: '/reports',               key: 'reports',               icon: PieChart },
      { href: '/sales-analysis',        key: 'salesAnalysis',         icon: TrendingUp },
      { href: '/gross-margin',          key: 'grossMargin',           icon: DollarSign },
      { href: '/abc-analysis',          key: 'abcAnalysis',           icon: PieChart },
      { href: '/purchase-analysis',     key: 'purchaseAnalysis',      icon: BarChart3 },
      { href: '/supplier-performance',  key: 'supplierPerformance',   icon: Star },
      { href: '/salesperson-performance', key: 'salespersonPerformance', icon: Users },
      { href: '/return-analysis',       key: 'returnAnalysis',        icon: RotateCcw },
      { href: '/delivery-performance',  key: 'deliveryPerformance',   icon: BarChart3 },
      { href: '/fulfillment-rate',      key: 'fulfillmentRate',       icon: CheckCircle2 },
      { href: '/inventory-movement',    key: 'inventoryMovement',     icon: BarChart3 },
      { href: '/dead-stock',            key: 'deadStock',             icon: PackageX },
      { href: '/reorder-cycle',         key: 'reorderCycle',          icon: Clock },
      { href: '/traceability',          key: 'traceability',          icon: SearchCode },
      { href: '/expiry-tracking',       key: 'expiryTracking',        icon: Clock },
    ],
  },

  /* ─── 服務 ─── */
  {
    labelKey: 'groupService',
    items: [
      { href: '/after-sales', key: 'afterSales', icon: HeartHandshake },
      { href: '/care',        key: 'care',       icon: HeartHandshake },
      { href: '/knowledge',   key: 'knowledge',  icon: BookOpen },
    ],
  },

  /* ─── 組織行政 ─── */
  {
    labelKey: 'groupOrg',
    items: [
      { href: '/hr',             key: 'hr',            icon: UserSquare2 },
      { href: '/org-chart',      key: 'orgChart',      icon: Network },
      { href: '/announcements',  key: 'announcements', icon: Megaphone },
      { href: '/asset-loans',    key: 'assetLoans',    icon: BriefcaseBusiness },
      { href: '/region-mapping', key: 'regionMapping', icon: MapPinned },
    ],
  },

  /* ─── 系統 ─── */
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/approvals', key: 'approvals', icon: GitPullRequestArrow },
      { href: '/documents', key: 'documents', icon: FileArchive },
      { href: '/audit-log', key: 'auditLog',  icon: Shield },
      { href: '/users',     key: 'users',     icon: UserCog },
      { href: '/settings',  key: 'settings',  icon: Settings },
    ],
  },
]

/* ── Helpers ── */
const STORAGE_KEY = 'sidebar-collapsed-groups'
const STORAGE_SUB_KEY = 'sidebar-collapsed-subs'

function loadCollapsed(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function saveCollapsed(key: string, state: Record<string, boolean>) {
  try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
}

function getAllNavItems(groups: NavGroup[]): NavItem[] {
  const items: NavItem[] = []
  for (const g of groups) {
    for (const entry of g.items) {
      if (isSubGroup(entry)) items.push(...entry.items)
      else items.push(entry)
    }
  }
  return items
}

/* ── Component ── */
export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({})
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const { dict } = useI18n()

  // Load persisted state
  useEffect(() => {
    setGroupOpen(loadCollapsed(STORAGE_KEY))
    setSubOpen(loadCollapsed(STORAGE_SUB_KEY))
  }, [])

  // Load user's allowed modules
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => setAllowedModules(d.allowedModules ?? ['*']))
      .catch(() => setAllowedModules(['*']))
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setGroupOpen(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveCollapsed(STORAGE_KEY, next)
      return next
    })
  }, [])

  const toggleSub = useCallback((key: string) => {
    setSubOpen(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveCollapsed(STORAGE_SUB_KEY, next)
      return next
    })
  }, [])

  // Auto-expand group containing current page
  useEffect(() => {
    for (const group of navGroups) {
      const allItems = group.items.flatMap(e => isSubGroup(e) ? e.items : [e])
      if (allItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
        if (!groupOpen[group.labelKey]) {
          setGroupOpen(prev => {
            const next = { ...prev, [group.labelKey]: true }
            saveCollapsed(STORAGE_KEY, next)
            return next
          })
        }
        // also expand sub-group
        for (const entry of group.items) {
          if (isSubGroup(entry) && entry.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
            if (!subOpen[entry.subLabelKey]) {
              setSubOpen(prev => {
                const next = { ...prev, [entry.subLabelKey]: true }
                saveCollapsed(STORAGE_SUB_KEY, next)
                return next
              })
            }
          }
        }
        break
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Filter nav groups based on permissions
  const canAccess = (key: string) =>
    !allowedModules || allowedModules.includes('*') || allowedModules.includes(key)

  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      label: (dict.nav as Record<string, string>)[group.labelKey] ?? group.labelKey,
      items: group.items
        .map(entry => {
          if (isSubGroup(entry)) {
            const filtered = entry.items.filter(i => canAccess(i.key))
            return filtered.length > 0 ? { ...entry, items: filtered } : null
          }
          return canAccess(entry.key) ? entry : null
        })
        .filter(Boolean) as NavGroupEntry[],
    }))
    .filter(group => group.items.length > 0)

  const navLabel = (key: string) => (dict.nav as Record<string, string>)[key] ?? key

  function renderNavItem(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{navLabel(item.key)}</span>}
      </Link>
    )
  }

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
        {filteredGroups.map((group, gi) => {
          const isOpen = groupOpen[group.labelKey] !== false // default open
          return (
            <div key={group.labelKey} className={gi > 0 ? 'mt-1' : ''}>
              {/* Group header — clickable to expand/collapse */}
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.labelKey)}
                  className="flex w-full items-center justify-between px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown className={cn('h-3 w-3 transition-transform', !isOpen && '-rotate-90')} />
                </button>
              ) : (
                gi > 0 && <div className="mx-3 mb-1.5 mt-1.5 border-t border-slate-700" />
              )}

              {/* Group items */}
              {(collapsed || isOpen) && (
                <div className="space-y-0.5">
                  {group.items.map(entry => {
                    if (isSubGroup(entry)) {
                      const subIsOpen = subOpen[entry.subLabelKey] !== false
                      return (
                        <div key={entry.subLabelKey}>
                          {/* Sub-group header */}
                          {!collapsed && (
                            <button
                              onClick={() => toggleSub(entry.subLabelKey)}
                              className="flex w-full items-center gap-2 px-3 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', !subIsOpen && '-rotate-90')} />
                              <span>{navLabel(entry.subLabelKey)}</span>
                              <span className="ml-auto text-[10px] text-slate-600">{entry.items.length}</span>
                            </button>
                          )}
                          {(collapsed || subIsOpen) && (
                            <div className={cn('space-y-0.5', !collapsed && 'pl-2')}>
                              {entry.items.map(renderNavItem)}
                            </div>
                          )}
                        </div>
                      )
                    }
                    return renderNavItem(entry)
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
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
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  )
}
