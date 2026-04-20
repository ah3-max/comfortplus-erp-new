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
  Clock, DollarSign, CheckCircle2, Tag, Send, BellRing, Hash, DatabaseZap,
  Printer, AlertTriangle, BadgeDollarSign, FileCheck, Search,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */
export type NavItem = { href: string; key: string; icon: LucideIcon }
export type NavSubGroup = { subLabelKey: string; items: NavItem[] }
export type NavGroupEntry = NavItem | NavSubGroup
export type NavGroup = { labelKey: string; items: NavGroupEntry[] }

export function isSubGroup(entry: NavGroupEntry): entry is NavSubGroup {
  return 'subLabelKey' in entry
}

/* ── Nav Structure ── */
export const navGroups: NavGroup[] = [
  /* ─── 日常作業 ─── */
  {
    labelKey: 'groupDaily',
    items: [
      { href: '/dashboard',          key: 'dashboard',        icon: LayoutDashboard },
      { href: '/daily-reminder',     key: 'dailyReminder',    icon: BellRing },
      { href: '/crm',                key: 'crm',              icon: Crosshair },
      { href: '/institution-tours',  key: 'institutionTours', icon: MapPinned },
      { href: '/calendar',           key: 'calendar',         icon: CalendarDays },
    ],
  },

  /* ─── 銷售業務 ─── */
  {
    labelKey: 'groupSales',
    items: [
      {
        subLabelKey: 'subCustomers',
        items: [
          { href: '/customers',        key: 'customers',        icon: Users },
          { href: '/key-accounts',     key: 'keyAccounts',      icon: Star },
          { href: '/incidents',        key: 'incidents',        icon: AlertOctagon },
        ],
      },
      {
        subLabelKey: 'subOpportunity',
        items: [
          { href: '/pipeline',            key: 'pipeline',       icon: Target },
          { href: '/kpi',                 key: 'kpi',            icon: Zap },
          { href: '/tasks',               key: 'tasks',          icon: ListTodo },
          { href: '/sales-daily-report',  key: 'salesDailyReport', icon: Send },
          { href: '/meeting-records',     key: 'meetingRecords', icon: CalendarDays },
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
          { href: '/channel-orders', key: 'channelOrders', icon: ShoppingBag },
        ],
      },
    ],
  },

  /* ─── 商品庫存 ─── */
  {
    labelKey: 'groupInventory',
    items: [
      { href: '/products',              key: 'products',        icon: Package },
      { href: '/inventory',             key: 'inventory',       icon: BarChart3 },
      { href: '/inventory-safety',      key: 'inventorySafety', icon: AlertTriangle },
      { href: '/wms',                   key: 'wms',             icon: Warehouse },
      { href: '/inventory?tab=count',   key: 'stockCounts',     icon: ClipboardCheck },
      { href: '/internal-use',          key: 'internalUse',     icon: PackageX },
      { href: '/inbound',               key: 'inbound',         icon: PackageCheck },
    ],
  },

  /* ─── 出貨物流 ─── */
  {
    labelKey: 'groupLogistics',
    items: [
      { href: '/shipping-center', key: 'shippingCenter', icon: Package },
      { href: '/shipments',       key: 'shipments',      icon: Truck },
      { href: '/picking',         key: 'picking',        icon: ClipboardCheck },
      { href: '/dispatch',        key: 'dispatch',       icon: Truck },
      { href: '/logistics',       key: 'logistics',      icon: Navigation },
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
          { href: '/purchase-requests', key: 'purchaseRequests', icon: FileText },
          { href: '/suppliers',         key: 'suppliers',        icon: Building2 },
          { href: '/purchase-returns',  key: 'purchaseReturns',  icon: RotateCcw },
          { href: '/sea-freight',       key: 'seaFreight',       icon: Ship },
        ],
      },
      {
        subLabelKey: 'subManufacturing',
        items: [
          { href: '/production',            key: 'production',           icon: Factory },
          { href: '/material-requisitions', key: 'materialRequisitions', icon: Layers },
          { href: '/production-receipts',   key: 'productionReceipts',   icon: PackageCheck },
          { href: '/qc',                    key: 'qc',                   icon: ClipboardCheck },
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
          { href: '/finance',           key: 'finance',          icon: BarChart3 },
          { href: '/payments',          key: 'payments',         icon: CreditCard },
          { href: '/receipts',          key: 'receipts',         icon: CheckCircle2 },
          { href: '/expenses',          key: 'expenses',         icon: ReceiptText },
          { href: '/petty-cash',        key: 'pettyCash',        icon: Wallet },
        ],
      },
      {
        subLabelKey: 'subArAp',
        items: [
          { href: '/ar-aging',          key: 'arAging',          icon: Receipt },
          { href: '/ap-aging',          key: 'apAging',          icon: Receipt },
          { href: '/disbursements',     key: 'disbursements',    icon: CreditCard },
          { href: '/credit-management', key: 'creditManagement', icon: BadgeAlert },
          { href: '/finance/settlement', key: 'settlement',      icon: FileCheck },
        ],
      },
      {
        subLabelKey: 'subLedgers',
        items: [
          { href: '/finance/general-ledger', key: 'generalLedger', icon: BookOpen },
          { href: '/finance/account-detail', key: 'accountDetail', icon: BookOpen },
          { href: '/finance/cash-book',      key: 'cashBook',      icon: CreditCard },
          { href: '/finance/vat-ledger',     key: 'vatLedger',     icon: Receipt },
          { href: '/finance/input-tax',      key: 'inputTax',      icon: ReceiptText },
        ],
      },
      {
        subLabelKey: 'subOperations',
        items: [
          { href: '/finance/monthly-pl',              key: 'monthlyPL',             icon: BarChart3 },
          { href: '/finance/cash-flow-statement',     key: 'cashFlowStatement',     icon: BarChart3 },
          { href: '/finance/payment-summary',         key: 'paymentSummary',        icon: CreditCard },
          { href: '/finance/receipt-summary',         key: 'receiptSummary',        icon: Receipt },
          { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
          { href: '/finance/management-summary',      key: 'managementSummary',     icon: PieChart },
        ],
      },
      {
        subLabelKey: 'subFinSettings',
        items: [
          { href: '/bank-accounts',          key: 'bankAccounts',   icon: Landmark },
          { href: '/finance/bank/reconcile', key: 'bankReconcile',  icon: Scale },
          { href: '/cheques',                key: 'cheques',        icon: FileText },
          { href: '/vat-filings',            key: 'vatFilings',     icon: Receipt },
          { href: '/finance/vat',            key: 'vatSummary',     icon: Calculator },
          { href: '/period-close',           key: 'periodClose',    icon: CalendarCheck2 },
          { href: '/auto-journal',           key: 'autoJournal',    icon: Zap },
        ],
      },
    ],
  },

  /* ─── 通路 ─── */
  {
    labelKey: 'groupChannels',
    items: [
      { href: '/channels',          key: 'channels',        icon: Store },
      { href: '/price-tiers',       key: 'priceTiers',      icon: Layers },
      { href: '/discount-rules',    key: 'discountRules',   icon: HandCoins },
      { href: '/customer-pricing',  key: 'customerPricing', icon: BadgeDollarSign },
    ],
  },

  /* ─── 分析報表 ─── */
  {
    labelKey: 'groupAnalysis',
    items: [
      {
        subLabelKey: 'subSalesReports',
        items: [
          { href: '/reports',                 key: 'reports',                icon: PieChart },
          { href: '/sales-analysis',          key: 'salesAnalysis',          icon: TrendingUp },
          { href: '/gross-margin',            key: 'grossMargin',            icon: DollarSign },
          { href: '/salesperson-performance', key: 'salespersonPerformance', icon: Users },
          { href: '/competitor-prices',       key: 'competitorPrices',       icon: TrendingUp },
        ],
      },
      {
        subLabelKey: 'subOpsReports',
        items: [
          { href: '/purchase-analysis',    key: 'purchaseAnalysis',   icon: BarChart3 },
          { href: '/supplier-performance', key: 'supplierPerformance', icon: Star },
          { href: '/delivery-performance', key: 'deliveryPerformance', icon: BarChart3 },
          { href: '/inventory-movement',   key: 'inventoryMovement',  icon: BarChart3 },
          { href: '/dead-stock',           key: 'deadStock',          icon: PackageX },
        ],
      },
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
      { href: '/approvals',  key: 'approvals',  icon: GitPullRequestArrow },
      { href: '/documents',  key: 'documents',  icon: FileArchive },
      { href: '/warehouses', key: 'warehouses', icon: Warehouse },
      { href: '/audit-log',  key: 'auditLog',   icon: Shield },
      { href: '/users',      key: 'users',      icon: UserCog },
      { href: '/settings',   key: 'settings',   icon: Settings },
      { href: '/settings/expense-categories', key: 'expenseCategories', icon: BookOpen },
      { href: '/migration',  key: 'migration',  icon: DatabaseZap },
    ],
  },
]

/* ── Finance Role Nav (workflow-ordered) ── */
export const financeNavGroups: NavGroup[] = [
  /* 1. 今日工作台 */
  {
    labelKey: 'groupFinDaily',
    items: [
      { href: '/dashboard',   key: 'dashboard',     icon: LayoutDashboard },
      { href: '/finance',     key: 'finance',        icon: BarChart3 },
      { href: '/approvals',   key: 'approvals',      icon: GitPullRequestArrow },
      { href: '/announcements', key: 'announcements', icon: Megaphone },
    ],
  },

  /* 2. 應收管理 */
  {
    labelKey: 'groupFinAR',
    items: [
      {
        subLabelKey: 'subIncome',
        items: [
          { href: '/orders',         key: 'orders',         icon: ShoppingCart },
          { href: '/sales-invoices', key: 'salesInvoices',  icon: Receipt },
          { href: '/sales-returns',  key: 'salesReturns',   icon: RotateCcw },
          { href: '/e-invoices',     key: 'eInvoices',      icon: FileText },
        ],
      },
      {
        subLabelKey: 'subCollections',
        items: [
          { href: '/receipts',           key: 'receipts',          icon: CheckCircle2 },
          { href: '/ar-aging',           key: 'arAging',           icon: Receipt },
          { href: '/finance/settlement', key: 'settlement',        icon: FileCheck },
          { href: '/credit-management',  key: 'creditManagement',  icon: BadgeAlert },
        ],
      },
    ],
  },

  /* 3. 應付管理 */
  {
    labelKey: 'groupFinAP',
    items: [
      {
        subLabelKey: 'subDisbursements',
        items: [
          { href: '/payments',      key: 'payments',      icon: CreditCard },
          { href: '/ap-aging',      key: 'apAging',       icon: Receipt },
          { href: '/disbursements', key: 'disbursements', icon: HandCoins },
        ],
      },
      {
        subLabelKey: 'subExpense',
        items: [
          { href: '/expenses',    key: 'expenses',   icon: ReceiptText },
          { href: '/petty-cash',  key: 'pettyCash',  icon: Wallet },
        ],
      },
    ],
  },

  /* 4. 銀行與現金 */
  {
    labelKey: 'groupFinBank',
    items: [
      { href: '/bank-accounts',          key: 'bankAccounts',  icon: Landmark },
      { href: '/finance/bank/reconcile', key: 'bankReconcile', icon: Scale },
      { href: '/cheques',                key: 'cheques',       icon: FileText },
      { href: '/finance/cash-book',      key: 'cashBook',      icon: CreditCard },
    ],
  },

  /* 5. 總帳 */
  {
    labelKey: 'groupFinLedger',
    items: [
      {
        subLabelKey: 'subLedger',
        items: [
          { href: '/finance/general-ledger', key: 'generalLedger', icon: BookOpen },
          { href: '/finance/account-detail', key: 'accountDetail', icon: BookOpen },
          { href: '/finance/vat-ledger',     key: 'vatLedger',     icon: Receipt },
        ],
      },
      {
        subLabelKey: 'subTax',
        items: [
          { href: '/finance/input-tax', key: 'inputTax',   icon: ReceiptText },
          { href: '/finance/vat',       key: 'vatSummary', icon: Calculator },
          { href: '/vat-filings',       key: 'vatFilings', icon: Receipt },
        ],
      },
    ],
  },

  /* 6. 財務報表 */
  {
    labelKey: 'groupFinReports',
    items: [
      { href: '/finance/monthly-pl',              key: 'monthlyPL',             icon: BarChart3 },
      { href: '/finance/cash-flow-statement',     key: 'cashFlowStatement',     icon: BarChart3 },
      { href: '/finance/payment-summary',         key: 'paymentSummary',        icon: CreditCard },
      { href: '/finance/receipt-summary',         key: 'receiptSummary',        icon: Receipt },
      { href: '/finance/advance-payment-summary', key: 'advancePaymentSummary', icon: HandCoins },
      { href: '/finance/management-summary',      key: 'managementSummary',     icon: PieChart },
      { href: '/gross-margin',                    key: 'grossMargin',           icon: DollarSign },
      { href: '/sales-analysis',                  key: 'salesAnalysis',         icon: TrendingUp },
      { href: '/reports',                         key: 'reports',               icon: PieChart },
    ],
  },

  /* 7. 期末作業 */
  {
    labelKey: 'groupFinPeriod',
    items: [
      { href: '/auto-journal', key: 'autoJournal', icon: Zap },
      { href: '/period-close', key: 'periodClose', icon: CalendarCheck2 },
    ],
  },

  /* 8. 通路定價 */
  {
    labelKey: 'groupChannels',
    items: [
      { href: '/channels',          key: 'channels',        icon: Store },
      { href: '/price-tiers',       key: 'priceTiers',      icon: Layers },
      { href: '/discount-rules',    key: 'discountRules',   icon: HandCoins },
      { href: '/customer-pricing',  key: 'customerPricing', icon: BadgeDollarSign },
    ],
  },

  /* 9. 系統 */
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/documents', key: 'documents', icon: FileArchive },
      { href: '/audit-log', key: 'auditLog',  icon: Shield },
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
  const [userRole, setUserRole] = useState<string | null>(null)
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({})
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { dict } = useI18n()

  // Load persisted state
  useEffect(() => {
    setGroupOpen(loadCollapsed(STORAGE_KEY))
    setSubOpen(loadCollapsed(STORAGE_SUB_KEY))
  }, [])

  // Load user's allowed modules and role
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => {
        setAllowedModules(d.allowedModules ?? ['*'])
        setUserRole(d.role ?? null)
      })
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

  const activeGroups = userRole === 'FINANCE' ? financeNavGroups : navGroups

  const filteredGroups = activeGroups
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

  // Flat list of all visible items for search
  const allVisibleItems: Array<{ item: NavItem; groupLabel: string }> = filteredGroups.flatMap(group =>
    group.items.flatMap(entry =>
      isSubGroup(entry)
        ? entry.items.map(item => ({ item, groupLabel: group.label }))
        : [{ item: entry as NavItem, groupLabel: group.label }]
    )
  )

  const searchResults = searchQuery.trim()
    ? allVisibleItems.filter(({ item }) =>
        (navLabel(item.key) + item.href).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

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

      {/* Search bar */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={(dict.nav as Record<string, string>).navSearch ?? '搜尋功能...'}
              className="w-full rounded-md bg-slate-800 py-1.5 pl-8 pr-3 text-xs text-slate-300 placeholder-slate-500 outline-none ring-0 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs leading-none"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2">
        {/* Search results */}
        {searchResults && !collapsed && (
          <div className="space-y-0.5">
            {searchResults.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">找不到符合的功能</p>
            ) : (
              searchResults.map(({ item, groupLabel }) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSearchQuery('')}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{navLabel(item.key)}</span>
                      <span className="shrink-0 text-[10px] text-slate-600">{groupLabel}</span>
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Normal grouped nav (hidden when searching) */}
        {!searchResults && filteredGroups.map((group, gi) => {
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
