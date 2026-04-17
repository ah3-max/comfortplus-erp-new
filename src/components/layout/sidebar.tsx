'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
  Printer, AlertTriangle, ArrowDownLeft, ArrowUpRight, Search, LockKeyhole,
  BadgeDollarSign, FileCheck,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ── */
export type BadgeKey = 'expensesPending' | 'expensesToPay' | 'arOverdue' | 'apToPay' | 'bankUnreconciled'
export type QuickVariant = 'incoming' | 'outgoing' | 'petty'
export type NavItem = {
  href: string
  key: string
  icon: LucideIcon
  variant?: 'quick'
  quickVariant?: QuickVariant
  badge?: BadgeKey
}
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
      { href: '/products',           key: 'products',         icon: Package },
      { href: '/inventory',          key: 'inventory',        icon: BarChart3 },
      { href: '/inventory-safety',   key: 'inventorySafety',  icon: AlertTriangle },
      { href: '/wms',                key: 'wms',              icon: Warehouse },
      { href: '/inventory?tab=count', key: 'stockCounts',    icon: ClipboardCheck },
      { href: '/internal-use',       key: 'internalUse',      icon: PackageX },
      { href: '/inbound',            key: 'inbound',          icon: PackageCheck },
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
      /* 收款/付款 快速按鈕 */
      { href: '/payments?direction=INCOMING', key: 'incomingPayments', icon: ArrowDownLeft, variant: 'quick' },
      { href: '/payments?direction=OUTGOING', key: 'outgoingPayments', icon: ArrowUpRight,  variant: 'quick' },
      {
        subLabelKey: 'subIncome',
        items: [
          { href: '/ar-aging',    key: 'arAging',   icon: Receipt },
          { href: '/e-invoices',  key: 'eInvoices', icon: FileText },
        ],
      },
      {
        subLabelKey: 'subCollections',
        items: [
          { href: '/receipts',    key: 'receipts',  icon: CheckCircle2 },
        ],
      },
      {
        subLabelKey: 'subTax',
        items: [
          { href: '/finance/input-tax', key: 'inputTax',   icon: ReceiptText },
          { href: '/finance/vat',       key: 'vatSummary', icon: Calculator },
        ],
      },
      {
        subLabelKey: 'subExpense',
        items: [
          { href: '/ap-aging',   key: 'apAging',   icon: Receipt },
          { href: '/expenses',   key: 'expenses',  icon: ReceiptText },
          { href: '/petty-cash', key: 'pettyCash', icon: Wallet },
        ],
      },
      {
        subLabelKey: 'subLedger',
        items: [
          { href: '/finance/general-ledger',  key: 'generalLedger', icon: BookOpen },
          { href: '/bank-accounts',           key: 'bankAccounts',  icon: Landmark },
          { href: '/finance/bank/reconcile',  key: 'bankReconcile', icon: Scale },
          { href: '/finance/cash-book',       key: 'cashBook',      icon: CreditCard },
          { href: '/period-close',            key: 'periodClose',   icon: LockKeyhole },
        ],
      },
      {
        subLabelKey: 'subFinReports',
        items: [
          { href: '/finance/monthly-pl',          key: 'monthlyPL',         icon: BarChart3 },
          { href: '/finance/cash-flow-statement', key: 'cashFlowStatement', icon: BarChart3 },
          { href: '/gross-margin',                key: 'grossMargin',       icon: DollarSign },
        ],
      },
    ],
  },

  /* ─── 通路 ─── */
  {
    labelKey: 'groupChannels',
    items: [
      { href: '/channels',       key: 'channels',      icon: Store },
      { href: '/price-tiers',    key: 'priceTiers',    icon: Layers },
      { href: '/discount-rules', key: 'discountRules', icon: HandCoins },
    ],
  },

  /* ─── 分析報表 ─── */
  {
    labelKey: 'groupAnalysis',
    items: [
      {
        subLabelKey: 'subSalesReports',
        items: [
          { href: '/reports',                 key: 'reports',               icon: PieChart },
          { href: '/sales-analysis',          key: 'salesAnalysis',         icon: TrendingUp },
          { href: '/gross-margin',            key: 'grossMargin',           icon: DollarSign },
          { href: '/salesperson-performance', key: 'salespersonPerformance', icon: Users },
          { href: '/competitor-prices',       key: 'competitorPrices',      icon: TrendingUp },
        ],
      },
      {
        subLabelKey: 'subOpsReports',
        items: [
          { href: '/purchase-analysis',     key: 'purchaseAnalysis',    icon: BarChart3 },
          { href: '/supplier-performance',  key: 'supplierPerformance', icon: Star },
          { href: '/delivery-performance',  key: 'deliveryPerformance', icon: BarChart3 },
          { href: '/inventory-movement',    key: 'inventoryMovement',   icon: BarChart3 },
          { href: '/dead-stock',            key: 'deadStock',           icon: PackageX },
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
      { href: '/customer-pricing', key: 'customerPricing', icon: BadgeDollarSign },
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

/* ─── FINANCE 角色專屬導航（依工作頻率重排） ─── */
export const financeNavGroups: NavGroup[] = [
  {
    labelKey: 'groupFinDaily',
    items: [
      { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'groupFinQuick',
    items: [
      { href: '/payments?direction=INCOMING', key: 'incomingPayments', icon: ArrowDownLeft, variant: 'quick', quickVariant: 'incoming' },
      { href: '/payments?direction=OUTGOING', key: 'outgoingPayments', icon: ArrowUpRight,  variant: 'quick', quickVariant: 'outgoing' },
      { href: '/petty-cash',                  key: 'pettyCash',        icon: Wallet,        variant: 'quick', quickVariant: 'petty' },
    ],
  },
  {
    labelKey: 'groupFinAR',
    items: [
      { href: '/e-invoices',  key: 'eInvoices', icon: FileText },
      { href: '/ar-aging',    key: 'arAging',   icon: Receipt, badge: 'arOverdue' },
      { href: '/receipts',    key: 'receipts',  icon: CheckCircle2 },
      { href: '/finance/settlement', key: 'settlement', icon: FileCheck },
    ],
  },
  {
    labelKey: 'groupFinAP',
    items: [
      { href: '/finance/input-tax', key: 'inputTax',  icon: ReceiptText },
      { href: '/ap-aging',          key: 'apAging',   icon: Receipt, badge: 'apToPay' },
      { href: '/expenses',          key: 'expenses',  icon: ReceiptText, badge: 'expensesPending' },
    ],
  },
  {
    labelKey: 'groupFinBank',
    items: [
      { href: '/finance/bank/reconcile', key: 'bankReconcile', icon: Scale, badge: 'bankUnreconciled' },
      { href: '/finance/cash-book',      key: 'cashBook',      icon: CreditCard },
      { href: '/bank-accounts',          key: 'bankAccounts',  icon: Landmark },
    ],
  },
  {
    labelKey: 'groupFinPeriod',
    items: [
      { href: '/period-close',                key: 'periodClose',       icon: LockKeyhole },
      { href: '/finance/vat',                 key: 'vatSummary',        icon: Calculator },
      { href: '/finance/monthly-pl',          key: 'monthlyPL',         icon: BarChart3 },
      { href: '/finance/cash-flow-statement', key: 'cashFlowStatement', icon: BarChart3 },
      { href: '/gross-margin',                key: 'grossMargin',       icon: DollarSign },
    ],
  },
  {
    labelKey: 'groupFinLedger',
    items: [
      { href: '/finance/general-ledger', key: 'generalLedger', icon: BookOpen },
      { href: '/finance/account-list',   key: 'accountList',   icon: BookOpen },
    ],
  },
  {
    labelKey: 'groupSystem',
    items: [
      { href: '/customer-pricing', key: 'customerPricing', icon: BadgeDollarSign },
      { href: '/approvals', key: 'approvals', icon: GitPullRequestArrow },
      { href: '/documents', key: 'documents', icon: FileArchive },
      { href: '/audit-log', key: 'auditLog',  icon: Shield },
      { href: '/settings',  key: 'settings',  icon: Settings },
      { href: '/settings/expense-categories', key: 'expenseCategories', icon: BookOpen },
    ],
  },
]

/* ── Helpers ── */
const STORAGE_KEY       = 'sidebar-collapsed-groups'
const STORAGE_SUB_KEY   = 'sidebar-collapsed-subs'
const STORAGE_PINNED    = 'sidebar-pinned'
const STORAGE_RECENT    = 'sidebar-recent'

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
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

const ALL_NAV_ITEMS = getAllNavItems([...navGroups, ...financeNavGroups])

type BadgeMap = Partial<Record<BadgeKey, number>>
const BADGE_COLORS: Record<BadgeKey, string> = {
  expensesPending: 'bg-amber-500 text-white',
  expensesToPay:   'bg-amber-500 text-white',
  arOverdue:       'bg-red-500 text-white',
  apToPay:         'bg-red-500 text-white',
  bankUnreconciled:'bg-blue-500 text-white',
}

/* ── Component ── */
export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const [groupOpen, setGroupOpen]   = useState<Record<string, boolean>>({})
  const [subOpen, setSubOpen]       = useState<Record<string, boolean>>({})
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([])
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
  const [badges, setBadges] = useState<BadgeMap>({})
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const isFinanceRole = role === 'FINANCE'
  const activeNavGroups = isFinanceRole ? financeNavGroups : navGroups

  /* ─ Persist helpers ─ */
  const toggleGroup = useCallback((key: string) => {
    setGroupOpen(prev => { const n = { ...prev, [key]: !prev[key] }; saveJson(STORAGE_KEY, n); return n })
  }, [])
  const toggleSub = useCallback((key: string) => {
    setSubOpen(prev => { const n = { ...prev, [key]: !prev[key] }; saveJson(STORAGE_SUB_KEY, n); return n })
  }, [])
  const togglePin = useCallback((href: string) => {
    setPinnedHrefs(prev => {
      const n = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
      saveJson(STORAGE_PINNED, n)
      return n
    })
  }, [])

  /* ─ Load persisted state ─ */
  useEffect(() => {
    setGroupOpen(loadJson(STORAGE_KEY, {}))
    setSubOpen(loadJson(STORAGE_SUB_KEY, {}))
    setPinnedHrefs(loadJson(STORAGE_PINNED, []))
    setRecentHrefs(loadJson(STORAGE_RECENT, []))
  }, [])

  /* ─ Load permissions ─ */
  useEffect(() => {
    fetch('/api/role-permissions/my')
      .then(r => r.json())
      .then(d => setAllowedModules(d.allowedModules ?? ['*']))
      .catch(() => setAllowedModules(['*']))
  }, [])

  /* ─ Poll sidebar badges (every 60s, also on route change) ─ */
  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/sidebar/badges')
        .then(r => r.ok ? r.json() : {})
        .then(d => { if (!cancelled) setBadges(d || {}) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [pathname])

  /* ─ Track recent pages ─ */
  useEffect(() => {
    const matched = ALL_NAV_ITEMS.find(item => {
      const qIdx = item.href.indexOf('?')
      if (qIdx === -1) return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
      const hPath = item.href.slice(0, qIdx)
      if (pathname !== hPath) return false
      const params = new URLSearchParams(item.href.slice(qIdx + 1))
      return Array.from(params.entries()).every(([k, v]) => searchParams.get(k) === v)
    })
    if (!matched) return
    setRecentHrefs(prev => {
      const n = [matched.href, ...prev.filter(h => h !== matched.href)].slice(0, 1)
      saveJson(STORAGE_RECENT, n)
      return n
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /* ─ Auto-expand group containing current page ─ */
  useEffect(() => {
    function matchesHref(href: string): boolean {
      const qIdx = href.indexOf('?')
      if (qIdx === -1) return pathname === href || pathname.startsWith(href + '/')
      const hrefPath = href.slice(0, qIdx)
      if (pathname !== hrefPath) return false
      const params = new URLSearchParams(href.slice(qIdx + 1))
      return Array.from(params.entries()).every(([k, v]) => searchParams.get(k) === v)
    }
    for (const group of activeNavGroups) {
      const allItems = group.items.flatMap(e => isSubGroup(e) ? e.items : [e])
      if (allItems.some(item => matchesHref(item.href))) {
        setGroupOpen(prev => { const n = { ...prev, [group.labelKey]: true }; saveJson(STORAGE_KEY, n); return n })
        for (const entry of group.items) {
          if (isSubGroup(entry) && entry.items.some(i => matchesHref(i.href))) {
            setSubOpen(prev => { const n = { ...prev, [entry.subLabelKey]: true }; saveJson(STORAGE_SUB_KEY, n); return n })
          }
        }
        break
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /* ─ Permissions filter ─ */
  const canAccess = (key: string) =>
    !allowedModules || allowedModules.includes('*') || allowedModules.includes(key)

  const filteredGroups = activeNavGroups
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

  function isNavItemActive(href: string): boolean {
    const qIdx = href.indexOf('?')
    if (qIdx === -1) return pathname === href || pathname.startsWith(href + '/')
    const hrefPath = href.slice(0, qIdx)
    if (pathname !== hrefPath) return false
    const params = new URLSearchParams(href.slice(qIdx + 1))
    return Array.from(params.entries()).every(([k, v]) => searchParams.get(k) === v)
  }

  /* ─ Render a single nav item ─ */
  function renderNavItem(item: NavItem, keyPrefix = '') {
    const active  = isNavItemActive(item.href)
    const isPinned = pinnedHrefs.includes(item.href)

    if (item.variant === 'quick') {
      // 財務快速操作按鈕（收款 / 付款 / 零用金）
      const qv: QuickVariant = item.quickVariant ?? (item.href.includes('INCOMING') ? 'incoming' : 'outgoing')
      const palette: Record<QuickVariant, { idle: string; active: string }> = {
        incoming: {
          idle: 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-600/30',
          active: 'bg-emerald-600 text-white border-emerald-600',
        },
        outgoing: {
          idle: 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-600/30',
          active: 'bg-blue-600 text-white border-blue-600',
        },
        petty: {
          idle: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30',
          active: 'bg-amber-500 text-white border-amber-500',
        },
      }
      const c = palette[qv]
      return (
        <Link
          key={keyPrefix + item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.97]',
            active ? c.active : c.idle,
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{navLabel(item.key)}</span>}
        </Link>
      )
    }

    const badgeCount = item.badge ? badges[item.badge] ?? 0 : 0
    const showBadge = badgeCount > 0

    return (
      <div key={keyPrefix + item.href} className="group/navitem relative">
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-[9px] text-[13.5px] font-medium transition-colors',
            active
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            !collapsed && isPinned && !active && 'pr-8'
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{navLabel(item.key)}</span>}
          {!collapsed && showBadge && (
            <span className={cn(
              'ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
              item.badge ? BADGE_COLORS[item.badge] : 'bg-slate-500 text-white',
            )}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
          {collapsed && showBadge && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Link>
        {/* Star / pin button */}
        {!collapsed && !showBadge && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.href) }}
            title={isPinned ? '取消釘選' : '釘選到我的最愛'}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition-all',
              isPinned
                ? 'text-amber-400 opacity-100 hover:text-amber-300'
                : 'text-slate-600 opacity-0 group-hover/navitem:opacity-100 hover:text-slate-300'
            )}
          >
            <Star className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
          </button>
        )}
      </div>
    )
  }

  /* ─ Visible pinned items (filtered by permission) ─ */
  const visiblePinned = pinnedHrefs
    .map(href => ALL_NAV_ITEMS.find(i => i.href === href))
    .filter((i): i is NavItem => !!i && canAccess(i.key))

  /* ─ Visible recent items (filtered by permission, exclude already pinned) ─ */
  const visibleRecent = recentHrefs
    .map(href => ALL_NAV_ITEMS.find(i => i.href === href))
    .filter((i): i is NavItem => !!i && canAccess(i.key) && !pinnedHrefs.includes(i.href))
    .slice(0, 1)

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-slate-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* ── Logo ── */}
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

      {/* ── Search bar (Cmd+K) ── */}
      <div className={cn('px-2 pt-2 pb-1', collapsed && 'flex justify-center')}>
        <button
          onClick={() => window.dispatchEvent(new Event('open-cmd-palette'))}
          className={cn(
            'flex items-center gap-2 rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800',
            collapsed
              ? 'h-9 w-9 justify-center'
              : 'w-full px-3 py-2 text-[13px]'
          )}
          title="搜尋功能 (Ctrl+K)"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{(dict.nav as Record<string, string>).searchPlaceholder ?? '搜尋功能…'}</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                Ctrl K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">

        {/* ── Pinned Favorites ── */}
        {!collapsed && visiblePinned.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-amber-500/80">
              <Star className="h-3 w-3 fill-current" />
              <span>{(dict.nav as Record<string, string>).pinnedPages ?? '我的最愛'}</span>
            </div>
            <div className="space-y-0.5">
              {visiblePinned.map(item => renderNavItem(item, 'pin-'))}
            </div>
          </div>
        )}

        {/* ── Recent Pages ── */}
        {!collapsed && visibleRecent.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Clock className="h-3 w-3" />
              <span>{(dict.nav as Record<string, string>).recentPages ?? '最近瀏覽'}</span>
            </div>
            <div className="space-y-0.5">
              {visibleRecent.map(item => renderNavItem(item, 'rec-'))}
            </div>
          </div>
        )}

        {/* ── Main nav groups ── */}
        {filteredGroups.map((group, gi) => {
          const isOpen = groupOpen[group.labelKey] !== false
          return (
            <div key={group.labelKey} className={gi > 0 ? 'mt-0.5' : ''}>
              {/* Group header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.labelKey)}
                  className="flex w-full items-center justify-between px-3 pb-0.5 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')} />
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
                          {!collapsed && (
                            <button
                              onClick={() => toggleSub(entry.subLabelKey)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              <ChevronDown className={cn('h-3 w-3 transition-transform', !subIsOpen && '-rotate-90')} />
                              <span>{navLabel(entry.subLabelKey)}</span>
                              <span className="ml-auto text-[10.5px] text-slate-600">{entry.items.length}</span>
                            </button>
                          )}
                          {(collapsed || subIsOpen) && (
                            <div className={cn('space-y-0.5', !collapsed && 'pl-2')}>
                              {entry.items.map(item => renderNavItem(item))}
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

      {/* ── Logout ── */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-slate-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>{dict.header.logout}</span>}
        </button>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  )
}
