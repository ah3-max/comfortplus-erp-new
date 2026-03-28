'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CustomerForm, customerTypes, devStatusOptions, sourceOptions, regionOptions } from '@/components/customers/customer-form'
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, MessageCircle, Building2,
  ClipboardList, PhoneCall, ShoppingCart, Plus, Trash2, Loader2, User,
  FileText, Package, AlertCircle, TrendingUp, CheckCircle2, Clock, XCircle,
  Users, Star, BedDouble, Activity, Truck, ImagePlus, X, BarChart3, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

// ── 顏色 / 標籤常數 ───────────────────────────────────
const devStatusColors: Record<string, string> = {
  POTENTIAL:   'border-slate-300 text-slate-600',
  NEGOTIATING: 'bg-amber-100 text-amber-700 border-amber-200',
  CLOSED:      'bg-green-100 text-green-700 border-green-200',
  DORMANT:     'bg-slate-100 text-slate-500 border-slate-200',
  REJECTED:    'bg-red-50 text-red-500 border-red-200',
  OTHER:       'bg-slate-50 text-slate-500 border-slate-200',
}
const gradeColors: Record<string, string> = {
  A: 'bg-amber-400 text-white', B: 'bg-blue-400 text-white',
  C: 'bg-green-500 text-white', D: 'bg-slate-400 text-white',
}
const typeColors: Record<string, string> = {
  NURSING_HOME: 'bg-blue-100 text-blue-700', ELDERLY_HOME: 'bg-purple-100 text-purple-700',
  HOSPITAL: 'bg-red-100 text-red-700', DISTRIBUTOR: 'bg-green-100 text-green-700', OTHER: 'bg-slate-100 text-slate-600',
}
const orderStatusLabel: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', PROCESSING: '處理中',
  SHIPPED: '已出貨', DELIVERED: '已送達', COMPLETED: '已完成', CANCELLED: '已取消',
}
const quotationStatusLabel: Record<string, string> = {
  DRAFT: '草稿', SENT: '已送出', ACCEPTED: '已接受', REJECTED: '已拒絕', EXPIRED: '已過期', CONVERTED: '已轉訂單',
}
const quotationStatusColors: Record<string, string> = {
  DRAFT: 'border-slate-200 text-slate-500', SENT: 'bg-blue-50 text-blue-600 border-blue-200',
  ACCEPTED: 'bg-green-50 text-green-600 border-green-200', REJECTED: 'bg-red-50 text-red-500 border-red-200',
  EXPIRED: 'bg-slate-50 text-slate-400 border-slate-200', CONVERTED: 'bg-purple-50 text-purple-600 border-purple-200',
}
const complaintTypeLabel: Record<string, string> = {
  COMPLAINT: '客訴', AFTER_SALES: '售後服務', RETURN: '退貨申請', PRODUCT_ISSUE: '產品異常', OTHER: '其他',
}
const complaintStatusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  OPEN:        { label: '待處理', cls: 'bg-red-50 text-red-600 border-red-200',     icon: AlertCircle },
  IN_PROGRESS: { label: '處理中', cls: 'bg-amber-50 text-amber-600 border-amber-200', icon: Clock },
  RESOLVED:    { label: '已解決', cls: 'bg-green-50 text-green-600 border-green-200', icon: CheckCircle2 },
  CLOSED:      { label: '已關閉', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: XCircle },
}

// ── 互動日誌型別 ──────────────────────────────────────
interface FollowUpLog {
  id: string
  logDate: string
  logType: string
  content: string
  result: string | null
  customerReaction: string | null
  nextFollowUpDate: string | null
  nextAction: string | null
  hasSample: boolean
  hasQuote: boolean
  hasOrder: boolean
  contactPerson: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}

const LOG_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  CALL:         { label: '電話',   color: 'bg-blue-100 text-blue-700',    icon: '📞' },
  LINE:         { label: 'LINE',   color: 'bg-green-100 text-green-700',  icon: '💬' },
  EMAIL:        { label: 'Email',  color: 'bg-purple-100 text-purple-700', icon: '✉️' },
  MEETING:      { label: '會議',   color: 'bg-indigo-100 text-indigo-700', icon: '🤝' },
  FIRST_VISIT:  { label: '初訪',   color: 'bg-amber-100 text-amber-700',  icon: '🚪' },
  SECOND_VISIT: { label: '二訪',   color: 'bg-amber-100 text-amber-700',  icon: '🔄' },
  THIRD_VISIT:  { label: '三訪+',  color: 'bg-orange-100 text-orange-700', icon: '⭐' },
  DELIVERY:     { label: '送貨',   color: 'bg-teal-100 text-teal-700',    icon: '📦' },
  EXPO:         { label: '展覽',   color: 'bg-rose-100 text-rose-700',    icon: '🏛️' },
  OTHER:        { label: '其他',   color: 'bg-slate-100 text-slate-600',  icon: '📝' },
}

const REACTION_CONFIG: Record<string, { label: string; color: string }> = {
  POSITIVE:    { label: '正面',  color: 'text-green-600' },
  NEUTRAL:     { label: '普通',  color: 'text-slate-500' },
  NEGATIVE:    { label: '拒絕',  color: 'text-red-500' },
  NO_RESPONSE: { label: '未接/無回應', color: 'text-slate-400' },
}

// ── 型別定義 ──────────────────────────────────────────
interface VisitRecord {
  id: string; visitDate: string; purpose: string | null; content: string | null
  result: string | null; nextAction: string | null; nextVisitDate: string | null
  visitedBy: { id: string; name: string }
}
interface CallRecord {
  id: string; callDate: string; duration: number | null; purpose: string | null
  content: string | null; result: string | null; calledBy: { id: string; name: string }
}
interface SampleRecord {
  id: string; sentDate: string; items: string; trackingNo: string | null
  recipient: string | null; followUpDate: string | null; followUpResult: string | null
  notes: string | null; sentBy: { id: string; name: string }
}
interface ComplaintRecord {
  id: string; complaintDate: string; type: string; content: string; status: string
  severity: string; handler: string | null; resolution: string | null
  resolvedAt: string | null; closedAt: string | null
  assignedSupervisor: { id: string; name: string } | null
  supervisorAppointDate: string | null
  firstResponseAt: string | null; firstResponseMethod: string | null
  nextFollowUpDate: string | null; nextFollowUpMethod: string | null
  photoUrls: { url: string; label: string; category: string; uploadedAt: string }[] | null
  reportedBy: { id: string; name: string }
  _count: { logs: number }
}
interface Quotation {
  id: string; quotationNo: string; status: string; totalAmount: string
  createdAt: string; validUntil: string | null
}
interface SalesOrder {
  id: string; orderNo: string; status: string; totalAmount: string; createdAt: string
}
interface CustomerContact {
  id: string; name: string; role: string | null; title: string | null
  department: string | null; mobile: string | null; phone: string | null
  phoneExt: string | null; email: string | null; lineId: string | null
  isPrimary: boolean; preferredContactTime: string | null; notes: string | null
}
interface Customer {
  id: string; code: string; name: string; type: string; contactPerson: string | null
  phone: string | null; lineId: string | null; email: string | null
  address: string | null; region: string | null; taxId: string | null
  paymentTerms: string | null; creditLimit: string | null; grade: string | null
  devStatus: string; source: string | null; salesRepId: string | null
  salesRep: { id: string; name: string } | null
  winRate: number | null; estimatedMonthlyVolume: string | null
  notes: string | null; isActive: boolean
  // new org fields
  isCorporateFoundation: boolean; corporateFoundationName: string | null
  branchName: string | null; orgLevel: string | null; bedCount: number | null
  // key account fields
  isKeyAccount: boolean; keyAccountMgrId: string | null
  keyAccountMgr: { id: string; name: string } | null
  visitFrequencyDays: number | null; relationshipScore: number | null
  keyAccountNote: string | null; keyAccountSince: string | null
  lastContactDate: string | null
  visitRecords: VisitRecord[]; callRecords: CallRecord[]
  sampleRecords: SampleRecord[]; complaintRecords: ComplaintRecord[]
  quotations: Quotation[]; salesOrders: SalesOrder[]
  contacts: CustomerContact[]
  _count: { visitRecords: number; callRecords: number; salesOrders: number; sampleRecords: number; complaintRecords: number; quotations: number }
}

function fmt(v: string | number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const visitPurposes   = ['初訪', '複訪', '服務巡訪', '教育訓練', '合約簽訂', '問題處理', '上線輔導']
const callPurposes    = ['問候電訪', '訂單確認', '產品介紹', '問題處理', '滿意度追蹤', '促銷推廣']
const complaintTypes  = ['COMPLAINT','AFTER_SALES','RETURN','PRODUCT_ISSUE','OTHER']
const complaintStatuses = ['OPEN','IN_PROGRESS','RESOLVED','CLOSED']

type TabKey = 'info'|'timeline'|'followup'|'contacts'|'usage'|'delivery'|'forecast'|'visits'|'calls'|'samples'|'quotations'|'orders'|'opportunities'|'complaints'

interface Opportunity {
  id: string
  title: string
  stage: string
  probability: number
  expectedAmount: string | null
  expectedCloseDate: string | null
  productInterest: string | null
  notes: string | null
  isActive: boolean
  updatedAt: string
  owner: { id: string; name: string } | null
  _count: { followUpLogs: number }
}

const OPP_STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  PROSPECTING:    { label: '潛在開發',  color: 'bg-slate-100 text-slate-600' },
  CONTACTED:      { label: '已接觸',   color: 'bg-blue-100 text-blue-700' },
  VISITED:        { label: '已拜訪',   color: 'bg-indigo-100 text-indigo-700' },
  NEEDS_ANALYSIS: { label: '需求確認', color: 'bg-purple-100 text-purple-700' },
  SAMPLING:       { label: '樣品試用', color: 'bg-teal-100 text-teal-700' },
  QUOTED:         { label: '已報價',   color: 'bg-amber-100 text-amber-700' },
  NEGOTIATING:    { label: '議價中',   color: 'bg-orange-100 text-orange-700' },
  REGULAR_ORDER:  { label: '穩定成交', color: 'bg-green-100 text-green-700' },
  LOST:           { label: '已失單',   color: 'bg-red-100 text-red-600' },
  INACTIVE:       { label: '暫停',     color: 'bg-slate-100 text-slate-400' },
}
type ContactFormData = { name: string; role: string; title: string; department: string; mobile: string; phone: string; phoneExt: string; email: string; lineId: string; isPrimary: boolean; preferredContactTime: string; notes: string }

interface TimelineEvent {
  id: string; eventType: string; date: string
  actor: { id: string; name: string } | null
  title: string; summary: string; meta: Record<string, unknown>
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { dict } = useI18n()
  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [loading, setLoading]     = useState(true)
  const [editOpen, setEditOpen]   = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('followup')
  const [timeline, setTimeline]   = useState<TimelineEvent[]>([])
  const [tlLoading, setTlLoading] = useState(false)
  const [saving, setSaving]       = useState(false)

  // Follow-up log state
  const [followUpLogs,   setFollowUpLogs]   = useState<FollowUpLog[]>([])
  const [showLogForm,    setShowLogForm]     = useState(false)
  const [logType,        setLogType]         = useState('CALL')
  const [logContent,     setLogContent]      = useState('')
  const [logResult,      setLogResult]       = useState('')
  const [logReaction,    setLogReaction]     = useState('NEUTRAL')
  const [logNextDate,    setLogNextDate]     = useState('')
  const [logNextAction,  setLogNextAction]   = useState('')
  const [logHasSample,   setLogHasSample]    = useState(false)
  const [submittingLog,  setSubmittingLog]   = useState(false)

  // Dialog states
  const [visitOpen,     setVisitOpen]     = useState(false)
  const [callOpen,      setCallOpen]      = useState(false)
  const [sampleOpen,    setSampleOpen]    = useState(false)
  // complaint state now handled in <ComplaintsTab />
  const [contactOpen,   setContactOpen]   = useState(false)
  const [editContact,   setEditContact]   = useState<CustomerContact | null>(null)

  // Forms
  const [visitForm, setVisitForm] = useState({ visitDate: new Date().toISOString().slice(0,10), purpose: '', content: '', result: '', nextAction: '', nextVisitDate: '' })
  const [callForm,  setCallForm]  = useState({ callDate: new Date().toISOString().slice(0,10), duration: '', purpose: '', content: '', result: '' })
  const [sampleForm, setSampleForm] = useState({ sentDate: new Date().toISOString().slice(0,10), items: '', trackingNo: '', recipient: '', followUpDate: '', notes: '' })
  const emptyContactForm = (): ContactFormData => ({ name: '', role: '', title: '', department: '', mobile: '', phone: '', phoneExt: '', email: '', lineId: '', isPrimary: false, preferredContactTime: '', notes: '' })
  const [contactForm, setContactForm] = useState<ContactFormData>(emptyContactForm())

  // Opportunity state
  const [opportunities,    setOpportunities]    = useState<Opportunity[]>([])
  const [showOppForm,      setShowOppForm]       = useState(false)
  const [oppTitle,         setOppTitle]          = useState('')
  const [oppStage,         setOppStage]          = useState('PROSPECTING')
  const [oppProb,          setOppProb]           = useState('10')
  const [oppAmount,        setOppAmount]         = useState('')
  const [oppCloseDate,     setOppCloseDate]      = useState('')
  const [oppNotes,         setOppNotes]          = useState('')
  const [savingOpp,        setSavingOpp]         = useState(false)

  // Key Account settings state
  const [editVisitFreq, setEditVisitFreq] = useState('')
  const [editRelScore,  setEditRelScore]  = useState('')
  const [editKaMgrId,   setEditKaMgrId]   = useState('')
  const [editKaNote,    setEditKaNote]    = useState('')
  const [savingKa,      setSavingKa]      = useState(false)
  const [usersForKa,    setUsersForKa]    = useState<{id:string;name:string}[]>([])

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/customers/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCustomer(data)
      // Initialize KA settings from loaded customer
      setEditVisitFreq(String(data.visitFrequencyDays ?? ''))
      setEditRelScore(String(data.relationshipScore ?? ''))
      setEditKaMgrId(data.keyAccountMgrId ?? '')
      setEditKaNote(data.keyAccountNote ?? '')
    }
    setLoading(false)
    // Also fetch follow-up logs
    const logsRes = await fetch(`/api/customers/${id}/followup?limit=50`)
    if (logsRes.ok) {
      const logsData = await logsRes.json()
      setFollowUpLogs(Array.isArray(logsData) ? logsData : (logsData.logs ?? []))
    }
    // Fetch opportunities
    const oppRes = await fetch(`/api/sales-opportunities?customerId=${id}&limit=50`)
    if (oppRes.ok) {
      const oppData = await oppRes.json()
      setOpportunities(Array.isArray(oppData) ? oppData : [])
    }
  }
  const fetchCustomer = load
  async function loadTimeline() {
    setTlLoading(true)
    const res = await fetch(`/api/customers/${id}/timeline`)
    if (res.ok) setTimeline(await res.json())
    setTlLoading(false)
  }
  useEffect(() => { load() }, [id])
  useEffect(() => { if (activeTab === 'timeline') loadTimeline() }, [id, activeTab])
  useEffect(() => {
    fetch('/api/users?limit=100').then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : (d.users ?? [])
      setUsersForKa(arr)
    }).catch(() => {})
  }, [])

  async function post(path: string, body: object) {
    setSaving(true)
    const res = await fetch(`/api/customers/${id}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    return res
  }

  async function del(path: string, recordId: string) {
    const res = await fetch(`/api/customers/${id}/${path}?recordId=${recordId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('已刪除'); load() }
    else toast.error('刪除失敗')
  }

  async function handleSubmitLog() {
    if (!logContent.trim()) { toast.error('請填寫互動內容'); return }
    setSubmittingLog(true)
    const res = await fetch(`/api/customers/${id}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logType,
        content: logContent,
        result: logResult || null,
        customerReaction: logReaction,
        nextFollowUpDate: logNextDate || null,
        nextAction: logNextAction || null,
        hasSample: logHasSample,
        logDate: new Date().toISOString(),
      }),
    })
    setSubmittingLog(false)
    if (res.ok) {
      toast.success('互動記錄已儲存')
      setShowLogForm(false)
      setLogContent(''); setLogResult(''); setLogReaction('NEUTRAL')
      setLogNextDate(''); setLogNextAction(''); setLogHasSample(false); setLogType('CALL')
      // Reload logs and customer
      const logsRes = await fetch(`/api/customers/${id}/followup?limit=50`)
      if (logsRes.ok) {
        const d = await logsRes.json()
        setFollowUpLogs(Array.isArray(d) ? d : (d.logs ?? []))
      }
      fetchCustomer()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '儲存失敗')
    }
  }

  async function handleToggleKeyAccount() {
    if (!customer) return
    const newVal = !customer.isKeyAccount
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isKeyAccount: newVal, ...(newVal && { keyAccountSince: new Date().toISOString() }) }),
    })
    if (res.ok) {
      toast.success(newVal ? '已標記為心臟客戶' : '已取消心臟客戶標記')
      fetchCustomer()
    } else toast.error('操作失敗')
  }

  async function handleSaveKeyAccount() {
    if (!customer) return
    setSavingKa(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitFrequencyDays: editVisitFreq ? Number(editVisitFreq) : null,
        relationshipScore:  editRelScore  ? Number(editRelScore)  : null,
        keyAccountMgrId:    editKaMgrId   || null,
        keyAccountNote:     editKaNote    || null,
      }),
    })
    setSavingKa(false)
    if (res.ok) { toast.success('設定已儲存'); fetchCustomer() }
    else toast.error('儲存失敗')
  }

  async function handleCreateOpportunity() {
    if (!oppTitle.trim()) { toast.error('請填寫商機標題'); return }
    setSavingOpp(true)
    const res = await fetch('/api/sales-opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId:        id,
        title:             oppTitle,
        stage:             oppStage,
        probability:       Number(oppProb) || 10,
        expectedAmount:    oppAmount    ? Number(oppAmount)    : null,
        expectedCloseDate: oppCloseDate ? oppCloseDate         : null,
        notes:             oppNotes     || null,
      }),
    })
    setSavingOpp(false)
    if (res.ok) {
      toast.success('商機已建立')
      setShowOppForm(false)
      setOppTitle(''); setOppStage('PROSPECTING'); setOppProb('10')
      setOppAmount(''); setOppCloseDate(''); setOppNotes('')
      const oppRes = await fetch(`/api/sales-opportunities?customerId=${id}&limit=50`)
      if (oppRes.ok) setOpportunities(await oppRes.json())
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? '建立失敗')
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!customer) return <div className="text-center py-20 text-muted-foreground">{dict.common.noData}</div>

  const typeName   = customerTypes.find(t => t.value === customer.type)?.label ?? customer.type
  const statusName = devStatusOptions.find(s => s.value === customer.devStatus)?.label ?? customer.devStatus
  const sourceName = sourceOptions.find(s => s.value === (customer.source ?? ''))?.label
  const regionName = regionOptions.find(r => r.value === customer.region)?.label ?? customer.region
  const openComplaints = customer.complaintRecords.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length

  const tabs: { key: TabKey; label: string; icon: React.ElementType; badge?: number; badgeRed?: boolean }[] = [
    { key: 'followup',   label: '互動時間軸', icon: PhoneCall, badge: followUpLogs.length },
    { key: 'timeline',   label: '追蹤時間軸', icon: Clock },
    { key: 'info',       label: '基本資料',   icon: User },
    { key: 'contacts',   label: '聯絡人',     icon: Users,         badge: customer.contacts?.length },
    { key: 'usage',      label: '使用輪廓',   icon: Activity },
    { key: 'delivery',   label: '配送條件',   icon: Truck },
    { key: 'forecast',   label: '銷售預估',   icon: BarChart3 },
    { key: 'visits',     label: '拜訪紀錄',   icon: ClipboardList, badge: customer._count.visitRecords },
    { key: 'calls',      label: '電訪紀錄',  icon: PhoneCall,     badge: customer._count.callRecords },
    { key: 'samples',    label: '樣品寄送',  icon: Package,       badge: customer._count.sampleRecords },
    { key: 'quotations', label: '報價紀錄',  icon: FileText,      badge: customer._count.quotations },
    { key: 'orders',     label: '訂單紀錄',  icon: ShoppingCart,  badge: customer._count.salesOrders },
    { key: 'opportunities' as TabKey, label: '銷售商機', icon: TrendingUp, badge: opportunities.filter(o => o.isActive).length || undefined },
    { key: 'complaints', label: '客訴售後',  icon: AlertCircle,   badge: customer._count.complaintRecords, badgeRed: openComplaints > 0 },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
              <span className="font-mono text-sm text-muted-foreground">{customer.code}</span>
              {customer.grade && (
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${gradeColors[customer.grade]}`}>{customer.grade}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[customer.type] ?? 'bg-slate-100 text-slate-600'}`}>{typeName}</span>
              <Badge variant="outline" className={`text-xs ${devStatusColors[customer.devStatus]}`}>{statusName}</Badge>
              {customer.isKeyAccount && (
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">⭐ 心臟客戶</span>
              )}
              {!customer.isActive && <Badge variant="outline" className="text-xs border-red-200 text-red-500">已停用</Badge>}
              {openComplaints > 0 && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200"><AlertCircle className="mr-1 h-3 w-3" />{openComplaints} 件待處理</Badge>}
              {customer.lastContactDate && (
                <span className="text-xs text-muted-foreground">
                  最後聯繫：{Math.floor((new Date().getTime() - new Date(customer.lastContactDate).getTime()) / 86400000)} 天前
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />{dict.common.edit}{dict.common.customer}</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">成交機率</p>
          {customer.winRate != null ? (
            <>
              <p className="mt-1 text-xl font-bold" style={{ color: customer.winRate >= 70 ? '#22c55e' : customer.winRate >= 40 ? '#f59e0b' : '#94a3b8' }}>
                {customer.winRate}%
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${customer.winRate}%`, backgroundColor: customer.winRate >= 70 ? '#22c55e' : customer.winRate >= 40 ? '#f59e0b' : '#94a3b8' }} />
              </div>
            </>
          ) : <p className="mt-1 text-lg text-muted-foreground">未設定</p>}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />預估月採購</p>
          <p className="mt-1 text-xl font-bold text-blue-600">
            {customer.estimatedMonthlyVolume ? fmt(customer.estimatedMonthlyVolume) : <span className="text-lg text-muted-foreground">未設定</span>}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">互動紀錄</p>
          <p className="mt-1 text-xl font-bold text-slate-700">
            {customer._count.visitRecords + customer._count.callRecords}
          </p>
          <p className="text-xs text-muted-foreground">拜訪 {customer._count.visitRecords} / 電訪 {customer._count.callRecords}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">{dict.customers.salesRep}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">{customer.salesRep?.name ?? dict.common.unassigned}</p>
          {customer.region && <p className="text-xs text-muted-foreground mt-0.5">{regionName}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-lg border bg-white">
        <div className="flex border-b overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-slate-700'
              }`}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${tab.badgeRed ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── 互動時間軸（FollowUpLog） ── */}
          {activeTab === 'followup' && (
            <div className="space-y-4">
              {/* Cold call counter banner */}
              {(customer.devStatus === 'POTENTIAL' || customer.devStatus === 'CONTACTED') && (
                <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length >= 3
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length >= 1
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  已聯繫 {followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length} 次
                  {followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length === 0 && ' — 尚未聯繫，開始第一通電話吧！'}
                </div>
              )}

              {/* Record button */}
              <div className="flex justify-end">
                <Button onClick={() => setShowLogForm(v => !v)}>
                  <Plus className="mr-2 h-4 w-4" />記錄互動
                </Button>
              </div>

              {/* Log form */}
              {showLogForm && (
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">新增互動記錄</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>互動類型</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={logType} onChange={e => setLogType(e.target.value)}>
                        <option value="CALL">📞 電話</option>
                        <option value="LINE">💬 LINE</option>
                        <option value="EMAIL">✉️ Email</option>
                        <option value="FIRST_VISIT">🚪 初訪</option>
                        <option value="SECOND_VISIT">🔄 二訪</option>
                        <option value="THIRD_VISIT">⭐ 三訪+</option>
                        <option value="MEETING">🤝 會議</option>
                        <option value="DELIVERY">📦 送貨</option>
                        <option value="EXPO">🏛️ 展覽</option>
                        <option value="OTHER">📝 其他</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>客戶反應</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={logReaction} onChange={e => setLogReaction(e.target.value)}>
                        <option value="NO_RESPONSE">未接/無回應</option>
                        <option value="NEGATIVE">拒絕</option>
                        <option value="NEUTRAL">普通</option>
                        <option value="POSITIVE">正面</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>互動內容 <span className="text-red-500">*</span></Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={3} value={logContent} onChange={e => setLogContent(e.target.value)}
                      placeholder="談話要點、客戶反應..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>結果</Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2} value={logResult} onChange={e => setLogResult(e.target.value)}
                      placeholder="結果、決定事項..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>下次追蹤日</Label>
                      <Input type="date" value={logNextDate} onChange={e => setLogNextDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>下次行動</Label>
                      <Input value={logNextAction} onChange={e => setLogNextAction(e.target.value)} placeholder="待辦事項..." />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="hasSample" checked={logHasSample} onChange={e => setLogHasSample(e.target.checked)} className="rounded" />
                    <Label htmlFor="hasSample" className="cursor-pointer">已提供樣品</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowLogForm(false)} disabled={submittingLog}>{dict.common.cancel}</Button>
                    <Button onClick={handleSubmitLog} disabled={submittingLog}>
                      {submittingLog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {dict.common.save}
                    </Button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative pl-8 border-l-2 border-slate-200 space-y-4">
                {followUpLogs.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-white border-2 border-blue-400 flex items-center justify-center text-[10px]">
                      {LOG_TYPE_CONFIG[log.logType]?.icon ?? '📝'}
                    </div>
                    <div className="bg-white border rounded-lg p-3 ml-2 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LOG_TYPE_CONFIG[log.logType]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                          {LOG_TYPE_CONFIG[log.logType]?.label ?? log.logType}
                        </span>
                        {log.customerReaction && (
                          <span className={`text-xs font-medium ${REACTION_CONFIG[log.customerReaction]?.color ?? 'text-slate-500'}`}>
                            {REACTION_CONFIG[log.customerReaction]?.label ?? log.customerReaction}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(log.logDate).toLocaleDateString('zh-TW')} · {log.createdBy.name}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{log.content}</p>
                      {log.result && <p className="text-slate-500 text-xs mt-1">結果：{log.result}</p>}
                      {log.nextFollowUpDate && (
                        <p className="text-blue-600 text-xs mt-1">
                          下次跟進：{new Date(log.nextFollowUpDate).toLocaleDateString('zh-TW')}
                          {log.nextAction && ` — ${log.nextAction}`}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {log.hasSample && <span className="text-xs text-teal-600 bg-teal-50 px-1.5 rounded">樣品</span>}
                        {log.hasQuote  && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 rounded">報價</span>}
                        {log.hasOrder  && <span className="text-xs text-green-600 bg-green-50 px-1.5 rounded">訂單</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {followUpLogs.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">尚無互動記錄，點擊上方按鈕開始記錄</p>
                )}
              </div>
            </div>
          )}

          {/* ── 追蹤時間軸 ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">完整互動歷程（所有聯繫、拜訪、報價、訂單）</p>
                <button onClick={loadTimeline} className="text-xs text-blue-600 hover:underline">{dict.common.refresh}</button>
              </div>
              {tlLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : timeline.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">尚無互動紀錄</p>
              ) : (
                <div className="relative">
                  {/* 時間軸線 */}
                  <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-slate-200" />
                  <div className="space-y-4">
                    {timeline.map(ev => {
                      const cfg: Record<string, { color: string; dot: string; label: string }> = {
                        followup:  { color: 'border-blue-200 bg-blue-50',    dot: 'bg-blue-500',   label: '追蹤' },
                        visit:     { color: 'border-green-200 bg-green-50',  dot: 'bg-green-500',  label: '拜訪' },
                        call:      { color: 'border-indigo-200 bg-indigo-50',dot: 'bg-indigo-500', label: '電訪' },
                        sample:    { color: 'border-violet-200 bg-violet-50',dot: 'bg-violet-500', label: '樣品' },
                        quotation: { color: 'border-amber-200 bg-amber-50',  dot: 'bg-amber-500',  label: '報價' },
                        order:     { color: 'border-teal-200 bg-teal-50',    dot: 'bg-teal-500',   label: '訂單' },
                        complaint: { color: 'border-red-200 bg-red-50',      dot: 'bg-red-500',    label: '客訴' },
                      }
                      const c = cfg[ev.eventType] ?? { color: 'border-slate-200', dot: 'bg-slate-400', label: '事件' }
                      return (
                        <div key={`${ev.eventType}-${ev.id}`} className="flex gap-3 relative">
                          <div className={`mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 border-white ring-2 z-10 ${c.dot}`} style={{ boxShadow: '0 0 0 2px white' }} />
                          <div className={`flex-1 rounded-lg border p-3 ${c.color}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.dot} text-white`}>{c.label}</span>
                                <span className="text-sm font-medium text-slate-800">{ev.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                {ev.actor && <span>{ev.actor.name}</span>}
                                <span>{fmtDate(ev.date)}</span>
                              </div>
                            </div>
                            {ev.summary && <p className="mt-1.5 text-sm text-slate-700 line-clamp-3">{ev.summary}</p>}
                            {/* Meta badges */}
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ev.meta.result ? <span className="text-xs bg-white/60 px-2 py-0.5 rounded border border-white/80">結果：{String(ev.meta.result)}</span> : null}
                              {ev.meta.hasQuote ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">已報價</span> : null}
                              {ev.meta.hasSample ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">樣品</span> : null}
                              {ev.meta.hasOrder ? <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">訂單</span> : null}
                              {ev.meta.status ? <span className="text-xs bg-white/60 px-2 py-0.5 rounded border border-white/80">{String(ev.meta.status)}</span> : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 基本資料 ── */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* 機構分類 */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">機構分類</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: '客戶類型',   value: customerTypes.find(t => t.value === customer.type)?.label ?? customer.type },
                    { label: '客戶層級',   value: { HEADQUARTERS: '總部', BRANCH: '分院/分館', STANDALONE: '單一機構' }[customer.orgLevel ?? ''] },
                    { label: '床數',       value: customer.bedCount != null ? `${customer.bedCount} 床` : null },
                    { label: dict.customers.region,   value: regionName },
                    { label: '分院/館別', value: customer.branchName },
                    { label: '社團法人',   value: customer.isCorporateFoundation ? (customer.corporateFoundationName ?? '是') : null },
                    { label: dict.customersExt.taxId,   value: customer.taxId },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-medium mt-0.5">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                {/* 聯絡資訊 */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">聯絡資訊</h3>
                  {[
                    { icon: User,           label: dict.customersExt.contactPerson, value: customer.contactPerson },
                    { icon: Phone,          label: dict.common.phone,       value: customer.phone },
                    { icon: MessageCircle,  label: 'LINE',       value: customer.lineId },
                    { icon: Mail,           label: dict.common.email,      value: customer.email },
                    { icon: MapPin,         label: dict.common.address,       value: customer.address },
                    { icon: Building2,      label: dict.customers.region,   value: regionName },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <row.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div><p className="text-xs text-muted-foreground">{row.label}</p><p className="text-sm font-medium">{row.value}</p></div>
                    </div>
                  ))}
                </div>
                {/* 業務與財務 */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">業務與財務資訊</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: dict.customers.devStatus, value: statusName },
                      { label: dict.customersExt.source, value: sourceName },
                      { label: dict.customersExt.paymentTerms, value: customer.paymentTerms },
                      { label: dict.customersExt.taxId, value: customer.taxId },
                      { label: dict.customersExt.creditLimit, value: customer.creditLimit ? fmt(customer.creditLimit) : null },
                      { label: dict.customers.salesRep, value: customer.salesRep?.name },
                    ].filter(r => r.value).map(row => (
                      <div key={row.label} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <p className="text-sm font-medium mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  {customer.notes && <><Separator /><div><p className="text-xs text-muted-foreground mb-1">備註</p><p className="text-sm whitespace-pre-wrap">{customer.notes}</p></div></>}
                </div>
              </div>

              {/* 心臟客戶設定 */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⭐</span>
                    <h3 className="font-semibold text-sm text-amber-900">心臟客戶設定</h3>
                  </div>
                  {/* Toggle isKeyAccount */}
                  <button
                    onClick={() => handleToggleKeyAccount()}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customer.isKeyAccount ? 'bg-amber-400' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${customer.isKeyAccount ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {customer.isKeyAccount && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* visitFrequencyDays */}
                    <div className="space-y-1">
                      <Label className="text-xs">拜訪頻率（天）</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={editVisitFreq}
                        onChange={e => setEditVisitFreq(e.target.value)}
                        placeholder="例：30"
                        min={1}
                      />
                    </div>
                    {/* relationshipScore */}
                    <div className="space-y-1">
                      <Label className="text-xs">關係深度（1-10）</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={editRelScore}
                        onChange={e => setEditRelScore(e.target.value)}
                        placeholder="1-10"
                        min={1} max={10}
                      />
                    </div>
                    {/* keyAccountMgrId */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">心臟客戶負責人</Label>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editKaMgrId}
                        onChange={e => setEditKaMgrId(e.target.value)}
                      >
                        <option value="">-- 不指定 --</option>
                        {usersForKa.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    {/* keyAccountNote */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">戰略備注</Label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"
                        rows={2}
                        value={editKaNote}
                        onChange={e => setEditKaNote(e.target.value)}
                        placeholder="此客戶的戰略重要性、特殊需求..."
                      />
                    </div>
                    {/* Save button */}
                    <div className="col-span-2 flex justify-end">
                      <Button size="sm" onClick={handleSaveKeyAccount} disabled={savingKa} className="h-7 text-xs">
                        {savingKa && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        儲存心臟客戶設定
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 聯絡人管理 ── */}
          {activeTab === 'contacts' && (
            <ContactsTab
              contacts={customer.contacts ?? []}
              customerId={id}
              contactOpen={contactOpen}
              setContactOpen={setContactOpen}
              editContact={editContact}
              setEditContact={setEditContact}
              contactForm={contactForm}
              setContactForm={setContactForm}
              emptyContactForm={emptyContactForm}
              saving={saving}
              setSaving={setSaving}
              reload={load}
            />
          )}

          {/* ── 使用輪廓 ── */}
          {activeTab === 'usage' && <UsageProfileTab customerId={id} />}

          {/* ── 配送條件 ── */}
          {activeTab === 'delivery' && <DeliveryProfileTab customerId={id} />}

          {/* ── 銷售預估 ── */}
          {activeTab === 'forecast' && <DemandForecastTab customerId={id} />}

          {/* ── 拜訪紀錄 ── */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setVisitOpen(true)}><Plus className="mr-2 h-4 w-4" />新增拜訪紀錄</Button>
              </div>
              {customer.visitRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">尚無拜訪紀錄</p>
                : customer.visitRecords.map(v => (
                <div key={v.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(v.visitDate)}</span>
                      {v.purpose && <Badge variant="outline" className="text-xs">{v.purpose}</Badge>}
                      <span className="text-xs text-muted-foreground">by {v.visitedBy.name}</span>
                    </div>
                    <button onClick={() => del('visits', v.id)} className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {v.content    && <p className="text-sm text-slate-700">{v.content}</p>}
                  {v.result     && <p className="text-sm"><span className="text-muted-foreground">結果：</span>{v.result}</p>}
                  {v.nextAction && <p className="text-sm text-blue-600">➤ {v.nextAction}{v.nextVisitDate && <span className="ml-2 text-muted-foreground">({fmtDate(v.nextVisitDate)})</span>}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 電訪紀錄 ── */}
          {activeTab === 'calls' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setCallOpen(true)}><Plus className="mr-2 h-4 w-4" />新增電訪紀錄</Button>
              </div>
              {customer.callRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">尚無電訪紀錄</p>
                : customer.callRecords.map(c => (
                <div key={c.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(c.callDate)}</span>
                      {c.purpose  && <Badge variant="outline" className="text-xs">{c.purpose}</Badge>}
                      {c.duration && <span className="text-xs text-muted-foreground">{c.duration} 分鐘</span>}
                      <span className="text-xs text-muted-foreground">by {c.calledBy.name}</span>
                    </div>
                    <button onClick={() => del('calls', c.id)} className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {c.content && <p className="text-sm text-slate-700">{c.content}</p>}
                  {c.result  && <p className="text-sm"><span className="text-muted-foreground">結果：</span>{c.result}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 樣品寄送 ── */}
          {activeTab === 'samples' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setSampleOpen(true)}><Plus className="mr-2 h-4 w-4" />新增樣品紀錄</Button>
              </div>
              {customer.sampleRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">尚無樣品寄送紀錄</p>
                : customer.sampleRecords.map(s => (
                <div key={s.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(s.sentDate)}</span>
                      <span className="text-xs text-muted-foreground">by {s.sentBy.name}</span>
                      {s.trackingNo && <Badge variant="outline" className="text-xs font-mono">{s.trackingNo}</Badge>}
                    </div>
                    <button onClick={() => del('samples', s.id)} className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-sm font-medium">{s.items}</p>
                  {s.recipient      && <p className="text-sm text-muted-foreground">收件人：{s.recipient}</p>}
                  {s.followUpDate   && <p className="text-sm text-amber-600">追蹤日：{fmtDate(s.followUpDate)}</p>}
                  {s.followUpResult && <p className="text-sm"><span className="text-muted-foreground">追蹤結果：</span>{s.followUpResult}</p>}
                  {s.notes          && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 報價紀錄 ── */}
          {activeTab === 'quotations' && (
            <div className="space-y-3">
              {customer.quotations.length === 0 ? <p className="py-10 text-center text-muted-foreground">尚無報價紀錄</p>
                : customer.quotations.map(q => (
                <div key={q.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/quotations/${q.id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{q.quotationNo}</span>
                    <Badge variant="outline" className={`text-xs ${quotationStatusColors[q.status] ?? ''}`}>{quotationStatusLabel[q.status] ?? q.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{fmt(q.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(q.createdAt)}</span>
                    {q.validUntil && <span className="text-xs text-muted-foreground">效期至 {fmtDate(q.validUntil)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 訂單紀錄 ── */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {customer.salesOrders.length === 0 ? <p className="py-10 text-center text-muted-foreground">尚無訂單紀錄</p>
                : customer.salesOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{o.orderNo}</span>
                    <Badge variant="outline" className="text-xs">{orderStatusLabel[o.status] ?? o.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{fmt(o.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 銷售商機 ── */}
          {activeTab === 'opportunities' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {opportunities.filter(o => o.isActive).length} 個進行中商機
                </p>
                <Button size="sm" onClick={() => setShowOppForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新增商機
                </Button>
              </div>

              {/* Create form */}
              {showOppForm && (
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">新增商機</p>
                    <button onClick={() => setShowOppForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">商機標題 *</Label>
                      <Input className="h-8 text-sm" value={oppTitle} onChange={e => setOppTitle(e.target.value)} placeholder="例：尿布月供合約" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">階段</Label>
                      <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={oppStage} onChange={e => setOppStage(e.target.value)}>
                        {Object.entries(OPP_STAGE_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">成交機率 %</Label>
                      <Input type="number" className="h-8 text-sm" value={oppProb}
                        onChange={e => setOppProb(e.target.value)} min={0} max={100} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">預期金額（元）</Label>
                      <Input type="number" className="h-8 text-sm" value={oppAmount}
                        onChange={e => setOppAmount(e.target.value)} placeholder="0" min={0} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">預計成交日</Label>
                      <Input type="date" className="h-8 text-sm" value={oppCloseDate}
                        onChange={e => setOppCloseDate(e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">備注</Label>
                      <Input className="h-8 text-sm" value={oppNotes}
                        onChange={e => setOppNotes(e.target.value)} placeholder="產品興趣、競品情況..." />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setShowOppForm(false)}>取消</Button>
                    <Button size="sm" onClick={handleCreateOpportunity} disabled={savingOpp}>
                      {savingOpp && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      建立
                    </Button>
                  </div>
                </div>
              )}

              {/* Opportunity list */}
              {opportunities.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  尚無商機記錄，點擊上方建立第一筆
                </div>
              ) : (
                <div className="space-y-2">
                  {opportunities.map(opp => {
                    const sc = OPP_STAGE_CONFIG[opp.stage] ?? { label: opp.stage, color: 'bg-slate-100 text-slate-600' }
                    const isLost = opp.stage === 'LOST' || !opp.isActive
                    return (
                      <div key={opp.id} className={`rounded-lg border bg-white p-3 ${isLost ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{opp.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sc.color}`}>{sc.label}</span>
                              <span className="text-xs text-muted-foreground">{opp.probability}%</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {opp.expectedAmount && (
                                <span>預期：{new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(opp.expectedAmount))}</span>
                              )}
                              {opp.expectedCloseDate && (
                                <span>預計：{new Date(opp.expectedCloseDate).toLocaleDateString('zh-TW')}</span>
                              )}
                              {opp.owner && <span>負責：{opp.owner.name}</span>}
                              <span>互動 {opp._count.followUpLogs} 次</span>
                            </div>
                            {opp.notes && <p className="text-xs text-slate-500 mt-1 truncate">{opp.notes}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 客訴售後 ── */}
          {activeTab === 'complaints' && <ComplaintsTab customerId={id} />}
        </div>
      </div>

      {/* ── 拜訪 Dialog ── */}
      <Dialog open={visitOpen} onOpenChange={o => !o && setVisitOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增拜訪紀錄</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('visits', visitForm); if (res.ok) { toast.success('已新增'); setVisitOpen(false); setVisitForm({ visitDate: new Date().toISOString().slice(0,10), purpose: '', content: '', result: '', nextAction: '', nextVisitDate: '' }); load() } else toast.error('失敗') }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>拜訪日期 *</Label><Input type="date" value={visitForm.visitDate} onChange={e => setVisitForm(p => ({ ...p, visitDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>目的</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={visitForm.purpose} onChange={e => setVisitForm(p => ({ ...p, purpose: e.target.value }))}>
                  <option value="">選擇目的</option>{visitPurposes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>拜訪內容</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={3} value={visitForm.content} onChange={e => setVisitForm(p => ({ ...p, content: e.target.value }))} placeholder="拜訪過程、討論事項..." /></div>
            <div className="space-y-1.5"><Label>拜訪結果</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} value={visitForm.result} onChange={e => setVisitForm(p => ({ ...p, result: e.target.value }))} placeholder="結果、客戶反應..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>下次跟進</Label><Input value={visitForm.nextAction} onChange={e => setVisitForm(p => ({ ...p, nextAction: e.target.value }))} placeholder="待辦事項..." /></div>
              <div className="space-y-1.5"><Label>下次拜訪日</Label><Input type="date" value={visitForm.nextVisitDate} onChange={e => setVisitForm(p => ({ ...p, nextVisitDate: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVisitOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 電訪 Dialog ── */}
      <Dialog open={callOpen} onOpenChange={o => !o && setCallOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增電訪紀錄</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('calls', callForm); if (res.ok) { toast.success('已新增'); setCallOpen(false); setCallForm({ callDate: new Date().toISOString().slice(0,10), duration: '', purpose: '', content: '', result: '' }); load() } else toast.error('失敗') }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>電訪日期 *</Label><Input type="date" value={callForm.callDate} onChange={e => setCallForm(p => ({ ...p, callDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>通話時長（分）</Label><Input type="number" value={callForm.duration} onChange={e => setCallForm(p => ({ ...p, duration: e.target.value }))} placeholder="5" min={1} /></div>
            </div>
            <div className="space-y-1.5"><Label>目的</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={callForm.purpose} onChange={e => setCallForm(p => ({ ...p, purpose: e.target.value }))}>
                <option value="">選擇目的</option>{callPurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>通話內容</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={3} value={callForm.content} onChange={e => setCallForm(p => ({ ...p, content: e.target.value }))} placeholder="談話要點..." /></div>
            <div className="space-y-1.5"><Label>結果</Label><Input value={callForm.result} onChange={e => setCallForm(p => ({ ...p, result: e.target.value }))} placeholder="客戶回應、結論..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCallOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 樣品 Dialog ── */}
      <Dialog open={sampleOpen} onOpenChange={o => !o && setSampleOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增樣品寄送紀錄</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('samples', sampleForm); if (res.ok) { toast.success('已新增'); setSampleOpen(false); setSampleForm({ sentDate: new Date().toISOString().slice(0,10), items: '', trackingNo: '', recipient: '', followUpDate: '', notes: '' }); load() } else toast.error('失敗') }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>寄送日期 *</Label><Input type="date" value={sampleForm.sentDate} onChange={e => setSampleForm(p => ({ ...p, sentDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>收件人</Label><Input value={sampleForm.recipient} onChange={e => setSampleForm(p => ({ ...p, recipient: e.target.value }))} placeholder="收件聯絡人" /></div>
            </div>
            <div className="space-y-1.5"><Label>樣品品項 *</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} value={sampleForm.items} onChange={e => setSampleForm(p => ({ ...p, items: e.target.value }))} placeholder="成人紙尿布 M 號 x2、護墊 L x1..." required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>寄送單號</Label><Input value={sampleForm.trackingNo} onChange={e => setSampleForm(p => ({ ...p, trackingNo: e.target.value }))} placeholder="快遞/宅配單號" /></div>
              <div className="space-y-1.5"><Label>預計追蹤日</Label><Input type="date" value={sampleForm.followUpDate} onChange={e => setSampleForm(p => ({ ...p, followUpDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>備註</Label><Input value={sampleForm.notes} onChange={e => setSampleForm(p => ({ ...p, notes: e.target.value }))} placeholder="備註..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSampleOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} onSuccess={load}
        customer={customer as Parameters<typeof CustomerForm>[0]['customer']} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// UsageProfileTab component
// ═══════════════════════════════════════════════════════════

const FOREIGN_COUNTRY_LABEL: Record<string, string> = {
  INDONESIA: '印尼', VIETNAM: '越南', PHILIPPINES: '菲律賓',
  THAILAND: '泰國', OTHER: '其他', NONE: '無',
}
const MGMT_QUALITY_LABEL: Record<string, string> = {
  GOOD: '很好', AVERAGE: '普通', NEEDS_IMPROVEMENT: '待加強', UNKNOWN: '不明',
}
const BRAND_SWITCH_LABEL: Record<string, string> = {
  ALMOST_NEVER: '幾乎不換', OCCASIONAL_TEST: '偶爾測試',
  QUARTERLY_EVAL: '每季評估', FREQUENT: '經常更換', PRICE_DRIVEN: '看價格決定',
}
const PROCUREMENT_STYLE_LABEL: Record<string, string> = {
  PRICE_ORIENTED: '價格導向', QUALITY_ORIENTED: '品質導向',
  STABLE_SUPPLY_ORIENTED: '穩定供貨導向', MANAGEMENT_DECIDES: '主管決定',
  FRONTLINE_DECIDES: '第一線決定', MIXED: '混合型',
}

type UsageForm = {
  totalBeds: string; occupiedBeds: string; vacantBeds: string; residentCareNote: string
  foreignCaregiverRatio: string; foreignCaregiverCountry: string
  managementQuality: string; currentBrands: string; competitorBrands: string
  brandSwitchFreq: string; easySwitchBrand: string; procurementStyle: string
  dailyDiaperLargeQty: string; dailyDiaperSmallQty: string
  dailyUnderpadsQty: string; dailyWipesQty: string; usesWipes: boolean
  monthlyDiaperLargeQty: string; monthlyDiaperSmallQty: string
  monthlyUnderpadsQty: string; monthlyWipesQty: string
}

function emptyUsageForm(): UsageForm {
  return {
    totalBeds: '', occupiedBeds: '', vacantBeds: '', residentCareNote: '',
    foreignCaregiverRatio: '', foreignCaregiverCountry: '',
    managementQuality: '', currentBrands: '', competitorBrands: '',
    brandSwitchFreq: '', easySwitchBrand: '', procurementStyle: '',
    dailyDiaperLargeQty: '', dailyDiaperSmallQty: '',
    dailyUnderpadsQty: '', dailyWipesQty: '', usesWipes: false,
    monthlyDiaperLargeQty: '', monthlyDiaperSmallQty: '',
    monthlyUnderpadsQty: '', monthlyWipesQty: '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profileToForm(p: any): UsageForm {
  const s = (v: unknown) => (v != null ? String(v) : '')
  return {
    totalBeds: s(p.totalBeds), occupiedBeds: s(p.occupiedBeds), vacantBeds: s(p.vacantBeds),
    residentCareNote: s(p.residentCareNote),
    foreignCaregiverRatio: s(p.foreignCaregiverRatio),
    foreignCaregiverCountry: s(p.foreignCaregiverCountry),
    managementQuality: s(p.managementQuality), currentBrands: s(p.currentBrands),
    competitorBrands: s(p.competitorBrands), brandSwitchFreq: s(p.brandSwitchFreq),
    easySwitchBrand: p.easySwitchBrand === true ? 'true' : p.easySwitchBrand === false ? 'false' : '',
    procurementStyle: s(p.procurementStyle),
    dailyDiaperLargeQty: s(p.dailyDiaperLargeQty), dailyDiaperSmallQty: s(p.dailyDiaperSmallQty),
    dailyUnderpadsQty: s(p.dailyUnderpadsQty), dailyWipesQty: s(p.dailyWipesQty),
    usesWipes: Boolean(p.usesWipes),
    monthlyDiaperLargeQty: s(p.monthlyDiaperLargeQty), monthlyDiaperSmallQty: s(p.monthlyDiaperSmallQty),
    monthlyUnderpadsQty: s(p.monthlyUnderpadsQty), monthlyWipesQty: s(p.monthlyWipesQty),
  }
}

function UsageProfileTab({ customerId }: { customerId: string }) {
  const [form, setForm] = useState<UsageForm>(emptyUsageForm())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${customerId}/usage-profile`)
      .then(r => r.json())
      .then(data => { if (data) setForm(profileToForm(data)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [customerId])

  function setField(k: keyof UsageForm, v: string | boolean) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Auto-calc monthly when daily changes
      const autoCalc: Record<string, keyof UsageForm> = {
        dailyDiaperLargeQty: 'monthlyDiaperLargeQty',
        dailyDiaperSmallQty: 'monthlyDiaperSmallQty',
        dailyUnderpadsQty:   'monthlyUnderpadsQty',
        dailyWipesQty:       'monthlyWipesQty',
      }
      if (k in autoCalc && typeof v === 'string') {
        const mk = autoCalc[k]
        const n = parseInt(v)
        ;(next as Record<string, string | boolean>)[mk] = isNaN(n) ? '' : String(n * 30)
      }
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...form,
      totalBeds: form.totalBeds ? Number(form.totalBeds) : null,
      occupiedBeds: form.occupiedBeds ? Number(form.occupiedBeds) : null,
      vacantBeds: form.vacantBeds ? Number(form.vacantBeds) : null,
      foreignCaregiverRatio: form.foreignCaregiverRatio ? Number(form.foreignCaregiverRatio) : null,
      foreignCaregiverCountry: form.foreignCaregiverCountry || null,
      managementQuality: form.managementQuality || null,
      brandSwitchFreq: form.brandSwitchFreq || null,
      easySwitchBrand: form.easySwitchBrand === 'true' ? true : form.easySwitchBrand === 'false' ? false : null,
      procurementStyle: form.procurementStyle || null,
      dailyDiaperLargeQty: form.dailyDiaperLargeQty ? Number(form.dailyDiaperLargeQty) : null,
      dailyDiaperSmallQty: form.dailyDiaperSmallQty ? Number(form.dailyDiaperSmallQty) : null,
      dailyUnderpadsQty: form.dailyUnderpadsQty ? Number(form.dailyUnderpadsQty) : null,
      dailyWipesQty: form.dailyWipesQty ? Number(form.dailyWipesQty) : null,
      monthlyDiaperLargeQty: form.monthlyDiaperLargeQty ? Number(form.monthlyDiaperLargeQty) : null,
      monthlyDiaperSmallQty: form.monthlyDiaperSmallQty ? Number(form.monthlyDiaperSmallQty) : null,
      monthlyUnderpadsQty: form.monthlyUnderpadsQty ? Number(form.monthlyUnderpadsQty) : null,
      monthlyWipesQty: form.monthlyWipesQty ? Number(form.monthlyWipesQty) : null,
    }
    const res = await fetch(`/api/customers/${customerId}/usage-profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) toast.success('使用輪廓已儲存')
    else toast.error('儲存失敗')
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>
  )

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── 床位資訊 ── */}
      <div>
        <SectionTitle>床位資訊</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>總床數</Label>
            <Input type="number" min={0} value={form.totalBeds} onChange={e => setField('totalBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>目前入住床數</Label>
            <Input type="number" min={0} value={form.occupiedBeds} onChange={e => setField('occupiedBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>空床數</Label>
            <Input type="number" min={0} value={form.vacantBeds} onChange={e => setField('vacantBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>住民失能型態備註</Label>
            <Input value={form.residentCareNote} onChange={e => setField('residentCareNote', e.target.value)} placeholder="如：重度失能為主…" />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 外籍照護 ── */}
      <div>
        <SectionTitle>外籍照護</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>外籍照護比例（%）</Label>
            <Input type="number" min={0} max={100} value={form.foreignCaregiverRatio} onChange={e => setField('foreignCaregiverRatio', e.target.value)} placeholder="0–100" />
          </div>
          <div className="space-y-1.5">
            <Label>外籍主要國籍</Label>
            <select className={sel} value={form.foreignCaregiverCountry} onChange={e => setField('foreignCaregiverCountry', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(FOREIGN_COUNTRY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 品牌與採購 ── */}
      <div>
        <SectionTitle>品牌與採購</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>管理品質評估</Label>
            <select className={sel} value={form.managementQuality} onChange={e => setField('managementQuality', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(MGMT_QUALITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>換品牌頻率</Label>
            <select className={sel} value={form.brandSwitchFreq} onChange={e => setField('brandSwitchFreq', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(BRAND_SWITCH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>目前使用品牌</Label>
            <Input value={form.currentBrands} onChange={e => setField('currentBrands', e.target.value)} placeholder="如：包大人、添寧…" />
          </div>
          <div className="space-y-1.5">
            <Label>競品品牌補充</Label>
            <Input value={form.competitorBrands} onChange={e => setField('competitorBrands', e.target.value)} placeholder="同時使用或評估中品牌" />
          </div>
          <div className="space-y-1.5">
            <Label>是否容易轉牌</Label>
            <select className={sel} value={form.easySwitchBrand} onChange={e => setField('easySwitchBrand', e.target.value)}>
              <option value="">不確定</option>
              <option value="true">容易</option>
              <option value="false">不容易</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>採購決策模式</Label>
            <select className={sel} value={form.procurementStyle} onChange={e => setField('procurementStyle', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(PROCUREMENT_STYLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 每日用量 ── */}
      <div>
        <SectionTitle>每日用量</SectionTitle>
        <div className="mb-3 flex items-center gap-3">
          <Label className="text-sm font-normal">是否使用濕紙巾</Label>
          <button type="button" onClick={() => setField('usesWipes', !form.usesWipes)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.usesWipes ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.usesWipes ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { field: 'dailyDiaperLargeQty' as keyof UsageForm, label: '每日大尿布（片）' },
            { field: 'dailyDiaperSmallQty' as keyof UsageForm, label: '每日小尿布（片）' },
            { field: 'dailyUnderpadsQty'   as keyof UsageForm, label: '每日看護墊（片）' },
            { field: 'dailyWipesQty'       as keyof UsageForm, label: '每日濕紙巾（片）', disabled: !form.usesWipes },
          ].map(({ field, label, disabled }) => (
            <div key={field} className="space-y-1.5">
              <Label className={disabled ? 'text-muted-foreground' : ''}>{label}</Label>
              <Input type="number" min={0} value={form[field] as string}
                onChange={e => setField(field, e.target.value)}
                disabled={disabled} placeholder="0" />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── 每月預估量 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <SectionTitle>每月預估量</SectionTitle>
          <span className="text-xs text-muted-foreground -mt-3">（自動帶入每日 × 30，可手動修改）</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { field: 'monthlyDiaperLargeQty' as keyof UsageForm, label: '大尿布（片/月）' },
            { field: 'monthlyDiaperSmallQty' as keyof UsageForm, label: '小尿布（片/月）' },
            { field: 'monthlyUnderpadsQty'   as keyof UsageForm, label: '看護墊（片/月）' },
            { field: 'monthlyWipesQty'       as keyof UsageForm, label: '濕紙巾（片/月）', disabled: !form.usesWipes },
          ].map(({ field, label, disabled }) => (
            <div key={field} className="space-y-1.5">
              <Label className={disabled ? 'text-muted-foreground' : ''}>{label}</Label>
              <Input type="number" min={0} value={form[field] as string}
                onChange={e => setField(field, e.target.value)}
                disabled={disabled}
                className={form[field] ? 'border-blue-200 bg-blue-50/30' : ''} placeholder="0" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存使用輪廓
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// ContactsTab component
// ═══════════════════════════════════════════════════════════

const CONTACT_ROLE_LABEL: Record<string, string> = {
  PURCHASING: '採購', DIRECTOR: '主任', HEAD_NURSE: '護理長',
  ACCOUNTING: '會計', ADMIN: '行政', OWNER: '老闆/負責人',
  WAREHOUSE: '倉管', RECEIVING: '收貨窗口', OTHER: '其他',
}
const CONTACT_ROLE_COLOR: Record<string, string> = {
  PURCHASING: 'bg-blue-100 text-blue-700', DIRECTOR: 'bg-purple-100 text-purple-700',
  HEAD_NURSE: 'bg-pink-100 text-pink-700', ACCOUNTING: 'bg-green-100 text-green-700',
  ADMIN: 'bg-slate-100 text-slate-600', OWNER: 'bg-amber-100 text-amber-700',
  WAREHOUSE: 'bg-orange-100 text-orange-700', RECEIVING: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-slate-100 text-slate-500',
}
const CONTACT_TIME_LABEL: Record<string, string> = {
  MORNING_9_11: '上午 09–11', NOON_11_13: '中午 11–13',
  AFTERNOON_13_15: '下午 13–15', AFTERNOON_15_17: '下午 15–17',
  BEFORE_NIGHT: '晚班前', AFTER_NIGHT: '晚班後',
  FLEXIBLE: '不固定', NEED_LINE: '需先 LINE', OTHER: '其他',
}
const contactRoles = Object.entries(CONTACT_ROLE_LABEL).map(([value, label]) => ({ value, label }))
const contactTimes = Object.entries(CONTACT_TIME_LABEL).map(([value, label]) => ({ value, label }))

interface ContactsTabProps {
  contacts: CustomerContact[]; customerId: string
  contactOpen: boolean; setContactOpen: (v: boolean) => void
  editContact: CustomerContact | null; setEditContact: (c: CustomerContact | null) => void
  contactForm: ContactFormData; setContactForm: (f: ContactFormData) => void
  emptyContactForm: () => ContactFormData
  saving: boolean; setSaving: (v: boolean) => void; reload: () => void
}

function ContactsTab({ contacts, customerId, contactOpen, setContactOpen, editContact, setEditContact, contactForm, setContactForm, emptyContactForm, saving, setSaving, reload }: ContactsTabProps) {
  function openNew() { setEditContact(null); setContactForm(emptyContactForm()); setContactOpen(true) }
  function openEdit(c: CustomerContact) {
    setEditContact(c)
    setContactForm({
      name: c.name, role: c.role ?? '', title: c.title ?? '',
      department: c.department ?? '', mobile: c.mobile ?? '',
      phone: c.phone ?? '', phoneExt: c.phoneExt ?? '',
      email: c.email ?? '', lineId: c.lineId ?? '',
      isPrimary: c.isPrimary, preferredContactTime: c.preferredContactTime ?? '', notes: c.notes ?? '',
    })
    setContactOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name) { return }
    setSaving(true)
    const url = editContact
      ? `/api/customers/${customerId}/contacts?contactId=${editContact.id}`
      : `/api/customers/${customerId}/contacts`
    const method = editContact ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactForm) })
    setSaving(false)
    setContactOpen(false)
    reload()
  }

  async function remove(contactId: string) {
    if (!confirm('確定刪除此聯絡人？')) return
    await fetch(`/api/customers/${customerId}/contacts?contactId=${contactId}`, { method: 'DELETE' })
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />新增聯絡人</Button>
      </div>

      {contacts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>尚未新增聯絡人</p>
          <p className="text-xs mt-1">點擊「新增聯絡人」建立結構化聯絡窗口</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map(c => (
            <div key={c.id} className={`rounded-lg border p-4 relative ${c.isPrimary ? 'border-blue-300 bg-blue-50/30' : 'bg-white'}`}>
              {c.isPrimary && (
                <span className="absolute top-3 right-10 text-xs font-medium text-blue-600 flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-blue-500 text-blue-500" />主窗口
                </span>
              )}
              <div className="flex items-start justify-between gap-2 pr-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    {c.role && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONTACT_ROLE_COLOR[c.role] ?? 'bg-slate-100 text-slate-500'}`}>
                        {CONTACT_ROLE_LABEL[c.role] ?? c.role}
                      </span>
                    )}
                  </div>
                  {(c.title || c.department) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[c.title, c.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {c.mobile && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Phone className="h-3 w-3 text-slate-400" />{c.mobile}（手機）</p>}
                    {c.phone && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Phone className="h-3 w-3 text-slate-400" />{c.phone}{c.phoneExt && ` 分機 ${c.phoneExt}`}（市話）</p>}
                    {c.lineId && <p className="text-xs flex items-center gap-1.5 text-slate-700"><MessageCircle className="h-3 w-3 text-slate-400" />LINE: {c.lineId}</p>}
                    {c.email && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Mail className="h-3 w-3 text-slate-400" />{c.email}</p>}
                    {c.preferredContactTime && (
                      <p className="text-xs flex items-center gap-1.5 text-blue-600">
                        <Clock className="h-3 w-3" />建議聯繫：{CONTACT_TIME_LABEL[c.preferredContactTime] ?? c.preferredContactTime}
                      </p>
                    )}
                    {c.notes && <p className="text-xs text-slate-500 italic mt-1">{c.notes}</p>}
                  </div>
                </div>
              </div>
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={o => !o && setContactOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editContact ? '編輯聯絡人' : '新增聯絡人'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>姓名 *</Label>
                <Input value={contactForm.name as string} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="聯絡人姓名" required />
              </div>
              <div className="space-y-1.5">
                <Label>聯絡人角色</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.role as string} onChange={e => setContactForm({ ...contactForm, role: e.target.value })}>
                  <option value="">請選擇</option>
                  {contactRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>職稱</Label>
                <Input value={contactForm.title as string} onChange={e => setContactForm({ ...contactForm, title: e.target.value })} placeholder="護理長、主任…" />
              </div>
              <div className="space-y-1.5">
                <Label>部門</Label>
                <Input value={contactForm.department as string} onChange={e => setContactForm({ ...contactForm, department: e.target.value })} placeholder="護理部、採購部…" />
              </div>
              <div className="space-y-1.5">
                <Label>手機</Label>
                <Input value={contactForm.mobile as string} onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })} placeholder="09xx-xxx-xxx" />
              </div>
              <div className="space-y-1.5">
                <Label>市話</Label>
                <div className="flex gap-2">
                  <Input value={contactForm.phone as string} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="02-xxxx-xxxx" className="flex-1" />
                  <Input value={contactForm.phoneExt as string} onChange={e => setContactForm({ ...contactForm, phoneExt: e.target.value })} placeholder="分機" className="w-20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>LINE</Label>
                <Input value={contactForm.lineId as string} onChange={e => setContactForm({ ...contactForm, lineId: e.target.value })} placeholder="@line_id" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={contactForm.email as string} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>建議聯絡時段</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.preferredContactTime as string} onChange={e => setContactForm({ ...contactForm, preferredContactTime: e.target.value })}>
                  <option value="">不限</option>
                  {contactTimes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div><p className="text-sm font-medium">設為主要窗口</p><p className="text-xs text-muted-foreground">設定後其他聯絡人主窗口身份將解除</p></div>
                  <button type="button" onClick={() => setContactForm({ ...contactForm, isPrimary: !contactForm.isPrimary })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${contactForm.isPrimary ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${contactForm.isPrimary ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>備註</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={contactForm.notes as string} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="備註（如：只接 LINE、勿直撥）" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving || !contactForm.name}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// DeliveryProfileTab component
// ═══════════════════════════════════════════════════════════

type PhotoEntry = { category: string; url: string; label: string }
type DeliveryForm = {
  deliveryAddress: string; unloadingLocation: string; unloadingFloor: string
  hasElevator: string; needsCart: string; hasReception: string
  receivingHours: string; suggestedDeliveryTime: string
  parkingNotes: string; routeNotes: string
  receiverName: string; receiverPhone: string; deliveryNotes: string
  photoUrls: PhotoEntry[]
}

const PHOTO_CATEGORIES = [
  { category: 'ENTRANCE',  label: '大門照' },
  { category: 'UNLOADING', label: '卸貨點照片' },
  { category: 'ELEVATOR',  label: '電梯位置' },
  { category: 'PARKING',   label: '停車位置' },
  { category: 'WAREHOUSE', label: '倉儲/收貨口' },
]

function emptyDeliveryForm(): DeliveryForm {
  return {
    deliveryAddress: '', unloadingLocation: '', unloadingFloor: '',
    hasElevator: '', needsCart: '', hasReception: '',
    receivingHours: '', suggestedDeliveryTime: '',
    parkingNotes: '', routeNotes: '',
    receiverName: '', receiverPhone: '', deliveryNotes: '',
    photoUrls: [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deliveryProfileToForm(p: any): DeliveryForm {
  const s = (v: unknown) => (v != null ? String(v) : '')
  const b = (v: unknown) => (v === true ? 'true' : v === false ? 'false' : '')
  return {
    deliveryAddress: s(p.deliveryAddress), unloadingLocation: s(p.unloadingLocation),
    unloadingFloor: s(p.unloadingFloor), hasElevator: b(p.hasElevator),
    needsCart: b(p.needsCart), hasReception: b(p.hasReception),
    receivingHours: s(p.receivingHours), suggestedDeliveryTime: s(p.suggestedDeliveryTime),
    parkingNotes: s(p.parkingNotes), routeNotes: s(p.routeNotes),
    receiverName: s(p.receiverName), receiverPhone: s(p.receiverPhone),
    deliveryNotes: s(p.deliveryNotes),
    photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
  }
}

function DeliveryProfileTab({ customerId }: { customerId: string }) {
  const [form, setForm] = useState<DeliveryForm>(emptyDeliveryForm())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${customerId}/delivery-profile`)
      .then(r => r.json())
      .then(data => { if (data) setForm(deliveryProfileToForm(data)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [customerId])

  function setField(k: keyof DeliveryForm, v: string | PhotoEntry[]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setPhotoUrl(category: string, url: string) {
    setForm(f => {
      const existing = f.photoUrls.filter(p => p.category !== category)
      const catLabel = PHOTO_CATEGORIES.find(c => c.category === category)?.label ?? category
      if (url) existing.push({ category, url, label: catLabel })
      return { ...f, photoUrls: existing }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...form,
      unloadingFloor: form.unloadingFloor ? Number(form.unloadingFloor) : null,
      hasElevator:    form.hasElevator === 'true' ? true : form.hasElevator === 'false' ? false : null,
      needsCart:      form.needsCart   === 'true' ? true : form.needsCart   === 'false' ? false : null,
      hasReception:   form.hasReception === 'true' ? true : form.hasReception === 'false' ? false : null,
    }
    const res = await fetch(`/api/customers/${customerId}/delivery-profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) toast.success('配送條件已儲存')
    else toast.error('儲存失敗')
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const yesNoOpts = [{ value: '', label: '未知' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>
  )

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── 收貨地址 ── */}
      <div>
        <SectionTitle>收貨資訊</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>收貨地址</Label>
            <Input value={form.deliveryAddress} onChange={e => setField('deliveryAddress', e.target.value)} placeholder="若與公司地址不同，填入實際收貨地址" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>下貨地點說明</Label>
            <Input value={form.unloadingLocation} onChange={e => setField('unloadingLocation', e.target.value)} placeholder="如：後門卸貨區、地下一樓貨梯旁…" />
          </div>
          <div className="space-y-1.5">
            <Label>下貨樓層</Label>
            <Input type="number" value={form.unloadingFloor} onChange={e => setField('unloadingFloor', e.target.value)} placeholder="如：B1、1、2" />
          </div>
          <div className="space-y-1.5">
            <Label>簽收窗口</Label>
            <Input value={form.receiverName} onChange={e => setField('receiverName', e.target.value)} placeholder="收貨負責人姓名" />
          </div>
          <div className="space-y-1.5">
            <Label>簽收電話</Label>
            <Input value={form.receiverPhone} onChange={e => setField('receiverPhone', e.target.value)} placeholder="收貨聯絡電話" />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 現場條件 ── */}
      <div>
        <SectionTitle>現場條件</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>是否有電梯</Label>
            <select className={sel} value={form.hasElevator} onChange={e => setField('hasElevator', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>是否需推車</Label>
            <select className={sel} value={form.needsCart} onChange={e => setField('needsCart', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>是否有管理室</Label>
            <select className={sel} value={form.hasReception} onChange={e => setField('hasReception', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 時段與動線 ── */}
      <div>
        <SectionTitle>時段與動線</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>收貨時段</Label>
            <Input value={form.receivingHours} onChange={e => setField('receivingHours', e.target.value)} placeholder="如：週一至週五 09:00–17:00" />
          </div>
          <div className="space-y-1.5">
            <Label>建議送貨時段</Label>
            <Input value={form.suggestedDeliveryTime} onChange={e => setField('suggestedDeliveryTime', e.target.value)} placeholder="如：上午 10:00 前" />
          </div>
          <div className="space-y-1.5">
            <Label>停車注意事項</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.parkingNotes} onChange={e => setField('parkingNotes', e.target.value)} placeholder="停車位置、費用、限制時間…" />
          </div>
          <div className="space-y-1.5">
            <Label>動線說明</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.routeNotes} onChange={e => setField('routeNotes', e.target.value)} placeholder="從大門→電梯→卸貨點的動線…" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>配送備註</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.deliveryNotes} onChange={e => setField('deliveryNotes', e.target.value)} placeholder="其他配送注意事項…" />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 配送照片 ── */}
      <div>
        <SectionTitle>配送參考照片</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">貼入照片網址（Google Drive 共用連結、內部圖床等）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PHOTO_CATEGORIES.map(({ category, label }) => {
            const entry = form.photoUrls.find(p => p.category === category)
            return (
              <div key={category} className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />{label}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={entry?.url ?? ''}
                    onChange={e => setPhotoUrl(category, e.target.value)}
                    placeholder="https://..."
                    className="flex-1 text-xs"
                  />
                  {entry?.url && (
                    <button type="button" onClick={() => setPhotoUrl(category, '')} className="text-slate-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {entry?.url && (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                    {entry.url}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存配送條件
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// DemandForecastTab component
// ═══════════════════════════════════════════════════════════

const ORDER_FREQ_LABEL: Record<string, string> = {
  WEEKLY: '每週', BIWEEKLY: '每兩週', MONTHLY: '每月', IRREGULAR: '不固定', URGENT_ONLY: '急單型',
}
const FORECAST_CONF_LABEL: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低' }
const TREND_LABEL: Record<string, { label: string; cls: string }> = {
  GROWING:   { label: '↗ 成長中', cls: 'text-green-600 bg-green-50' },
  DECLINING: { label: '↘ 衰退中', cls: 'text-red-600 bg-red-50' },
  STABLE:    { label: '→ 穩定',   cls: 'text-blue-600 bg-blue-50' },
}

type ForecastFormData = {
  dailyDiaperLargeQty: string; dailyDiaperSmallQty: string
  dailyUnderpadsQty: string; dailyWipesQty: string
  monthlyDiaperLargeQty: string; monthlyDiaperSmallQty: string
  monthlyUnderpadsQty: string; monthlyWipesQty: string
  orderFrequency: string; avgOrderQty: string
  nextExpectedOrderDate: string; forecastConfidence: string; notes: string
}

type Analytics = {
  orderCount: number; avgDaysBetweenOrders: number | null
  avgCasesPerOrder: number | null; last3OrdersTrend: string | null
  predictedNextOrderDate: string | null; lastOrderDate: string | null
}

function emptyForecastForm(): ForecastFormData {
  return {
    dailyDiaperLargeQty: '', dailyDiaperSmallQty: '',
    dailyUnderpadsQty: '', dailyWipesQty: '',
    monthlyDiaperLargeQty: '', monthlyDiaperSmallQty: '',
    monthlyUnderpadsQty: '', monthlyWipesQty: '',
    orderFrequency: '', avgOrderQty: '',
    nextExpectedOrderDate: '', forecastConfidence: '', notes: '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forecastToForm(f: any): ForecastFormData {
  const s = (v: unknown) => (v != null ? String(v) : '')
  const d = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : '')
  return {
    dailyDiaperLargeQty: s(f.dailyDiaperLargeQty), dailyDiaperSmallQty: s(f.dailyDiaperSmallQty),
    dailyUnderpadsQty: s(f.dailyUnderpadsQty), dailyWipesQty: s(f.dailyWipesQty),
    monthlyDiaperLargeQty: s(f.monthlyDiaperLargeQty), monthlyDiaperSmallQty: s(f.monthlyDiaperSmallQty),
    monthlyUnderpadsQty: s(f.monthlyUnderpadsQty), monthlyWipesQty: s(f.monthlyWipesQty),
    orderFrequency: s(f.orderFrequency), avgOrderQty: s(f.avgOrderQty),
    nextExpectedOrderDate: d(f.nextExpectedOrderDate),
    forecastConfidence: s(f.forecastConfidence), notes: s(f.notes),
  }
}

function DemandForecastTab({ customerId }: { customerId: string }) {
  const [form, setForm]           = useState<ForecastFormData>(emptyForecastForm())
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [storedForecast, setStoredForecast] = useState<{ analyticsUpdatedAt: string | null; predictedNextOrderDate: string | null; avgDaysBetweenOrders: number | null; avgCasesPerOrder: number | null; last3OrdersTrend: string | null } | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/customers/${customerId}/demand-forecast`)
    const data = await res.json()
    if (data) {
      setForm(forecastToForm(data))
      setStoredForecast(data)
    }
    setLoading(false)
  }

  async function runAnalytics() {
    setAnalyzing(true)
    const res = await fetch(`/api/customers/${customerId}/sales-analytics`)
    const json = await res.json()
    if (json.analytics) {
      setAnalytics(json.analytics)
      setStoredForecast(prev => prev ? { ...prev, ...json.analytics } : json.analytics)
    } else {
      toast.info('尚無歷史訂單可分析')
    }
    setAnalyzing(false)
  }

  async function syncFromUsage() {
    setSaving(true)
    const res = await fetch(`/api/customers/${customerId}/demand-forecast`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, syncFromUsage: true }),
    })
    const data = await res.json()
    setForm(forecastToForm(data))
    setSaving(false)
    toast.success('已從使用輪廓同步')
  }

  function setField(k: keyof ForecastFormData, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v }
      const autoCalc: Record<string, keyof ForecastFormData> = {
        dailyDiaperLargeQty: 'monthlyDiaperLargeQty',
        dailyDiaperSmallQty: 'monthlyDiaperSmallQty',
        dailyUnderpadsQty:   'monthlyUnderpadsQty',
        dailyWipesQty:       'monthlyWipesQty',
      }
      if (k in autoCalc) {
        const n = parseInt(v)
        next[autoCalc[k]] = isNaN(n) ? '' : String(n * 30)
      }
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/customers/${customerId}/demand-forecast`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) toast.success('銷售預估已儲存')
    else toast.error('儲存失敗')
  }

  useEffect(() => { load() }, [customerId])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>
  )

  const displayAnalytics = analytics ?? (storedForecast?.avgDaysBetweenOrders != null ? storedForecast : null)
  const trend = displayAnalytics?.last3OrdersTrend ? TREND_LABEL[displayAnalytics.last3OrdersTrend] : null

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── 歷史訂單分析 ── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>歷史訂單自動分析</SectionTitle>
          <Button type="button" variant="outline" size="sm" onClick={runAnalytics} disabled={analyzing}>
            {analyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            重新分析
          </Button>
        </div>
        {displayAnalytics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '歷史訂單數', value: `${'orderCount' in displayAnalytics ? displayAnalytics.orderCount : '—'} 張` },
              { label: '平均下單間隔', value: displayAnalytics.avgDaysBetweenOrders != null ? `${displayAnalytics.avgDaysBetweenOrders} 天` : '—' },
              { label: '平均每次箱數', value: displayAnalytics.avgCasesPerOrder != null ? `${displayAnalytics.avgCasesPerOrder} 箱` : '—' },
              { label: '近 3 次趨勢', value: trend ? undefined : '—', custom: trend ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${trend.cls}`}>{trend.label}</span>
              ) : null },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-white border p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.custom ? (
                  <div className="mt-1">{item.custom}</div>
                ) : (
                  <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">點擊「重新分析」從歷史訂單計算下單節奏</p>
          </div>
        )}
        {displayAnalytics?.predictedNextOrderDate && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              系統預測下次下單日：<span className="font-semibold">{fmtDate(displayAnalytics.predictedNextOrderDate)}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── 每日/月用量預估 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>用量預估</SectionTitle>
          <Button type="button" variant="outline" size="sm" onClick={syncFromUsage} disabled={saving}>
            從使用輪廓同步
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { dailyKey: 'dailyDiaperLargeQty' as keyof ForecastFormData, monthlyKey: 'monthlyDiaperLargeQty' as keyof ForecastFormData, label: '大尿布' },
            { dailyKey: 'dailyDiaperSmallQty' as keyof ForecastFormData, monthlyKey: 'monthlyDiaperSmallQty' as keyof ForecastFormData, label: '小尿布' },
            { dailyKey: 'dailyUnderpadsQty'   as keyof ForecastFormData, monthlyKey: 'monthlyUnderpadsQty'   as keyof ForecastFormData, label: '看護墊' },
            { dailyKey: 'dailyWipesQty'       as keyof ForecastFormData, monthlyKey: 'monthlyWipesQty'       as keyof ForecastFormData, label: '濕紙巾' },
          ].map(({ dailyKey, monthlyKey, label }) => (
            <div key={label} className="rounded-lg border bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">{label}</p>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">每日（片）</Label>
                <Input type="number" min={0} value={form[dailyKey] as string}
                  onChange={e => setField(dailyKey, e.target.value)} className="h-8 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">每月預估（片）</Label>
                <Input type="number" min={0} value={form[monthlyKey] as string}
                  onChange={e => setField(monthlyKey, e.target.value)}
                  className={`h-8 text-sm ${form[monthlyKey] ? 'border-blue-300 bg-blue-50' : ''}`} placeholder="自動" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── 下單節奏（手動）── */}
      <div>
        <SectionTitle>下單節奏（手動設定）</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>下單頻率</Label>
            <select className={sel} value={form.orderFrequency} onChange={e => setField('orderFrequency', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(ORDER_FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>平均每次下單量（包）</Label>
            <Input type="number" min={0} value={form.avgOrderQty} onChange={e => setField('avgOrderQty', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>下次預估下單日</Label>
            <Input type="date" value={form.nextExpectedOrderDate} onChange={e => setField('nextExpectedOrderDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>預估可信度</Label>
            <select className={sel} value={form.forecastConfidence} onChange={e => setField('forecastConfidence', e.target.value)}>
              <option value="">請選擇</option>
              {Object.entries(FORECAST_CONF_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>備註</Label>
            <Input value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="補充說明…" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存銷售預估
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// ComplaintsTab component
// ═══════════════════════════════════════════════════════════

const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:      { label: '低',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  MEDIUM:   { label: '中',  cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  HIGH:     { label: '高',  cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  CRITICAL: { label: '緊急', cls: 'bg-red-100 text-red-700 border-red-300' },
}
const ACTION_LABEL: Record<string, string> = {
  NOTE:           '備忘',
  PHONE_CALL:     '電話聯繫',
  ONSITE_VISIT:   '現場關心',
  EMAIL:          '電子郵件',
  LINE:           'LINE 聯繫',
  FIRST_RESPONSE: '首次回應',
  FOLLOW_UP:      '後續跟進',
  RESOLVED:       '標記解決',
  CLOSED:         '結案',
}
const METHOD_OPTIONS = ['PHONE_CALL','ONSITE_VISIT','EMAIL','LINE','VIDEO_CALL','OTHER']
const METHOD_LABEL: Record<string, string> = {
  PHONE_CALL: '電話', ONSITE_VISIT: '現場', EMAIL: '電郵', LINE: 'LINE',
  VIDEO_CALL: '視訊', OTHER: '其他',
}

interface CLog {
  id: string; logDate: string; action: string; description: string
  nextFollowUpDate: string | null; nextFollowUpMethod: string | null
  photoUrls: { url: string; label: string }[] | null
  loggedBy: { id: string; name: string }
}
interface CRecord {
  id: string; complaintDate: string; type: string; content: string; status: string
  severity: string; handler: string | null; resolution: string | null
  resolvedAt: string | null; closedAt: string | null
  assignedSupervisor: { id: string; name: string } | null
  supervisorAppointDate: string | null
  firstResponseAt: string | null; firstResponseMethod: string | null
  nextFollowUpDate: string | null; nextFollowUpMethod: string | null
  photoUrls: { url: string; label: string; category: string; uploadedAt: string }[] | null
  reportedBy: { id: string; name: string }
  _count: { logs: number }
}

const cSel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const cTa  = `${cSel} resize-none`

function ComplaintsTab({ customerId }: { customerId: string }) {
  const [records,      setRecords]      = useState<CRecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [logs,         setLogs]         = useState<Record<string, CLog[]>>({})
  const [logsLoading,  setLogsLoading]  = useState<string | null>(null)
  const [newOpen,      setNewOpen]      = useState(false)
  const [logTarget,    setLogTarget]    = useState<string | null>(null)
  const [updateTarget, setUpdateTarget] = useState<CRecord | null>(null)
  const [newFiles,     setNewFiles]     = useState<File[]>([])
  const [logFiles,     setLogFiles]     = useState<File[]>([])
  const [supervisors,  setSupervisors]  = useState<{ id: string; name: string }[]>([])

  const emptyNew = () => ({
    complaintDate: new Date().toISOString().slice(0,10),
    type: 'COMPLAINT', content: '', handler: '',
    severity: 'MEDIUM', assignedSupervisorId: '', supervisorAppointDate: '',
    photoUrls: [] as { url: string; label: string; category: string; uploadedAt: string }[],
  })
  const emptyLog = () => ({
    action: 'NOTE', description: '', nextFollowUpDate: '', nextFollowUpMethod: '',
    photoUrls: [] as { url: string; label: string }[],
  })
  const [newForm,    setNewForm]    = useState(emptyNew())
  const [logForm,    setLogForm]    = useState(emptyLog())
  const [updateForm, setUpdateForm] = useState({ status: '', resolution: '', handler: '' })

  async function loadRecords() {
    setLoading(true)
    const res = await fetch(`/api/customers/${customerId}/complaints`)
    if (res.ok) {
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : (data.records ?? []))
    }
    setLoading(false)
  }

  async function loadLogs(complaintId: string) {
    setLogsLoading(complaintId)
    const res = await fetch(`/api/complaints/${complaintId}/logs`)
    if (res.ok) { const data = await res.json(); setLogs(prev => ({ ...prev, [complaintId]: data })) }
    setLogsLoading(null)
  }

  useEffect(() => {
    loadRecords()
    fetch('/api/users?role=SUPERVISOR').then(r => r.ok ? r.json() : []).then(d => {
      setSupervisors(Array.isArray(d) ? d : (d.users ?? []))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  async function uploadFiles(files: File[]) {
    const results: { url: string; label: string; category: string; uploadedAt: string }[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file); fd.append('label', file.name); fd.append('category', 'complaint')
      const res = await fetch('/api/upload/complaint', { method: 'POST', body: fd })
      if (res.ok) results.push(await res.json())
    }
    return results
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const uploaded = await uploadFiles(newFiles)
    const body = { ...newForm, photoUrls: [...newForm.photoUrls, ...uploaded],
      assignedSupervisorId: newForm.assignedSupervisorId || null,
      supervisorAppointDate: newForm.supervisorAppointDate || null }
    const res = await fetch(`/api/customers/${customerId}/complaints`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { toast.success('已新增客訴/售後紀錄'); setNewOpen(false); setNewForm(emptyNew()); setNewFiles([]); loadRecords() }
    else toast.error('新增失敗')
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault()
    if (!logTarget) return
    setSaving(true)
    const uploaded = await uploadFiles(logFiles)
    const body = { ...logForm,
      photoUrls: [...logForm.photoUrls, ...uploaded.map(u => ({ url: u.url, label: u.label }))],
      nextFollowUpDate:   logForm.nextFollowUpDate   || null,
      nextFollowUpMethod: logForm.nextFollowUpMethod || null }
    const res = await fetch(`/api/complaints/${logTarget}/logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('已新增處理紀錄'); setLogTarget(null); setLogForm(emptyLog()); setLogFiles([])
      loadRecords(); loadLogs(logTarget)
    } else toast.error('新增失敗')
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!updateTarget) return
    setSaving(true)
    const res = await fetch(`/api/customers/${customerId}/complaints?recordId=${updateTarget.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: updateForm.status, resolution: updateForm.resolution, handler: updateForm.handler }),
    })
    setSaving(false)
    if (res.ok) { toast.success('已更新狀態'); setUpdateTarget(null); loadRecords() }
    else toast.error('更新失敗')
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/customers/${customerId}/complaints?recordId=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('已刪除'); loadRecords() }
    else toast.error('刪除失敗')
  }

  function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!logs[id]) loadLogs(id)
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-TW') : '—'
  const fmtDateTime = (d: string | null) => d
    ? new Date(d).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

  const openCount = records.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {openCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border border-red-200">
              <AlertCircle className="mr-1 h-3 w-3" />{openCount} 件待處理
            </Badge>
          )}
          {records.filter(r => r.severity === 'CRITICAL').length > 0 && (
            <Badge className="bg-red-600 text-white">
              緊急 {records.filter(r => r.severity === 'CRITICAL').length} 件
            </Badge>
          )}
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />新增客訴/售後紀錄
        </Button>
      </div>

      {records.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">尚無客訴或售後紀錄</p>
      )}

      {records.map(c => {
        const sc  = complaintStatusConfig[c.status]  ?? complaintStatusConfig.OPEN
        const sev = SEVERITY_CONFIG[c.severity] ?? SEVERITY_CONFIG.MEDIUM
        const isExpanded = expanded === c.id
        const noFirstResponse = !c.firstResponseAt && (c.status === 'OPEN' || c.status === 'IN_PROGRESS')
        const overdue = c.nextFollowUpDate && new Date(c.nextFollowUpDate) < new Date()
          && c.status !== 'RESOLVED' && c.status !== 'CLOSED'

        return (
          <div key={c.id} className={`rounded-lg border p-4 space-y-3 ${c.severity === 'CRITICAL' ? 'border-red-300 bg-red-50/30' : ''}`}>
            {/* Row 1: badges + actions */}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{fmtDate(c.complaintDate)}</span>
                <Badge variant="outline" className="text-xs">{complaintTypeLabel[c.type] ?? c.type}</Badge>
                <Badge variant="outline" className={`text-xs ${sc.cls}`}>
                  <sc.icon className="mr-1 h-3 w-3" />{sc.label}
                </Badge>
                <Badge variant="outline" className={`text-xs ${sev.cls}`}>{sev.label}嚴重度</Badge>
                {noFirstResponse && (
                  <Badge className="text-xs bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle className="mr-1 h-3 w-3" />未首次回應
                  </Badge>
                )}
                {overdue && (
                  <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-200">
                    <Clock className="mr-1 h-3 w-3" />逾期追蹤
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => toggleExpand(c.id)}
                  className="rounded px-2 py-1 text-xs hover:bg-slate-100 text-slate-500">
                  {isExpanded ? '收起' : `紀錄 ${c._count.logs}`}
                </button>
                <button onClick={() => { setLogTarget(c.id); setLogForm(emptyLog()) }}
                  className="rounded px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium">
                  + 新增處理紀錄
                </button>
                {(c.status === 'OPEN' || c.status === 'IN_PROGRESS') && (
                  <button onClick={() => { setUpdateTarget(c); setUpdateForm({ status: 'RESOLVED', resolution: c.resolution ?? '', handler: c.handler ?? '' }) }}
                    className="rounded px-2 py-1 hover:bg-green-50 text-green-600 text-xs font-medium">
                    更新狀態
                  </button>
                )}
                <button onClick={() => handleDelete(c.id)}
                  className="rounded p-1 hover:bg-red-50 text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-700">{c.content}</p>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>登錄人：{c.reportedBy.name}</span>
              {c.handler && <span>處理人：{c.handler}</span>}
              {c.assignedSupervisor && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />督導：{c.assignedSupervisor.name}
                  {c.supervisorAppointDate && ` (${fmtDate(c.supervisorAppointDate)})`}
                </span>
              )}
              {c.firstResponseAt ? (
                <span className="text-green-600">
                  首次回應：{fmtDateTime(c.firstResponseAt)}
                  {c.firstResponseMethod && ` · ${METHOD_LABEL[c.firstResponseMethod] ?? c.firstResponseMethod}`}
                </span>
              ) : (
                <span className="text-red-500">尚未首次回應</span>
              )}
              {c.nextFollowUpDate && (
                <span className={overdue ? 'text-orange-600 font-medium' : ''}>
                  下次追蹤：{fmtDate(c.nextFollowUpDate)}
                  {c.nextFollowUpMethod && ` · ${METHOD_LABEL[c.nextFollowUpMethod] ?? c.nextFollowUpMethod}`}
                </span>
              )}
              {c.resolvedAt && <span>解決於：{fmtDate(c.resolvedAt)}</span>}
              {c.closedAt   && <span>結案於：{fmtDate(c.closedAt)}</span>}
            </div>

            {/* Photos */}
            {c.photoUrls && c.photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {c.photoUrls.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer"
                    className="block rounded overflow-hidden border hover:opacity-90 transition-opacity">
                    <img src={p.url} alt={p.label} className="h-16 w-16 object-cover" />
                  </a>
                ))}
              </div>
            )}

            {/* Resolution */}
            {c.resolution && (
              <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                <span className="font-medium">處理結果：</span>{c.resolution}
              </p>
            )}

            {/* Expanded log timeline */}
            {isExpanded && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">處理時序</p>
                {logsLoading === c.id ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : (logs[c.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">尚無處理紀錄</p>
                ) : (
                  <div className="space-y-2">
                    {(logs[c.id] ?? []).map(log => (
                      <div key={log.id} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                          <div className="w-px flex-1 bg-slate-200 mt-1" />
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{fmtDateTime(log.logDate)}</span>
                            <Badge variant="outline" className="text-xs">{ACTION_LABEL[log.action] ?? log.action}</Badge>
                            <span className="text-xs text-muted-foreground">{log.loggedBy.name}</span>
                          </div>
                          <p className="text-slate-700 mt-0.5">{log.description}</p>
                          {log.nextFollowUpDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              下次：{fmtDate(log.nextFollowUpDate)}
                              {log.nextFollowUpMethod && ` · ${METHOD_LABEL[log.nextFollowUpMethod] ?? log.nextFollowUpMethod}`}
                            </p>
                          )}
                          {log.photoUrls && log.photoUrls.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {log.photoUrls.map((ph, i) => (
                                <a key={i} href={ph.url} target="_blank" rel="noreferrer"
                                  className="block rounded overflow-hidden border hover:opacity-90">
                                  <img src={ph.url} alt={ph.label} className="h-10 w-10 object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── 新增客訴 Dialog ── */}
      <Dialog open={newOpen} onOpenChange={o => { if (!o) { setNewOpen(false); setNewFiles([]) } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增客訴/售後紀錄</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>日期 *</Label>
                <Input type="date" value={newForm.complaintDate}
                  onChange={e => setNewForm(p => ({ ...p, complaintDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>類型</Label>
                <select className={cSel} value={newForm.type}
                  onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))}>
                  {complaintTypes.map(t => <option key={t} value={t}>{complaintTypeLabel[t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>嚴重程度</Label>
              <div className="flex gap-2">
                {(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => setNewForm(p => ({ ...p, severity: s }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${newForm.severity === s ? SEVERITY_CONFIG[s].cls + ' border-current' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    {SEVERITY_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>客訴/售後內容 *</Label>
              <textarea className={cTa} rows={4} value={newForm.content}
                onChange={e => setNewForm(p => ({ ...p, content: e.target.value }))}
                placeholder="詳細描述客訴/售後問題..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>處理人員</Label>
                <Input value={newForm.handler}
                  onChange={e => setNewForm(p => ({ ...p, handler: e.target.value }))}
                  placeholder="負責處理人員" />
              </div>
              <div className="space-y-1.5">
                <Label>指派照護督導</Label>
                <select className={cSel} value={newForm.assignedSupervisorId}
                  onChange={e => setNewForm(p => ({ ...p, assignedSupervisorId: e.target.value }))}>
                  <option value="">不指派</option>
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {newForm.assignedSupervisorId && (
              <div className="space-y-1.5">
                <Label>督導約訪時間</Label>
                <Input type="datetime-local" value={newForm.supervisorAppointDate}
                  onChange={e => setNewForm(p => ({ ...p, supervisorAppointDate: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>上傳照片/截圖</Label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400 transition-colors">
                <ImagePlus className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-muted-foreground">點擊選擇或拍照上傳</span>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                  onChange={e => setNewFiles(Array.from(e.target.files ?? []))} />
              </label>
              {newFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {newFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded border" />
                      <button type="button"
                        onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewOpen(false); setNewFiles([]) }} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}新增紀錄
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 新增處理紀錄 Dialog ── */}
      <Dialog open={!!logTarget} onOpenChange={o => { if (!o) { setLogTarget(null); setLogFiles([]) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增處理紀錄</DialogTitle></DialogHeader>
          <form onSubmit={handleAddLog} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>處理動作</Label>
                <select className={cSel} value={logForm.action}
                  onChange={e => setLogForm(p => ({ ...p, action: e.target.value }))}>
                  {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>聯繫方式</Label>
                <select className={cSel} value={logForm.nextFollowUpMethod}
                  onChange={e => setLogForm(p => ({ ...p, nextFollowUpMethod: e.target.value }))}>
                  <option value="">不填</option>
                  {METHOD_OPTIONS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>處理說明 *</Label>
              <textarea className={cTa} rows={4} value={logForm.description}
                onChange={e => setLogForm(p => ({ ...p, description: e.target.value }))}
                placeholder="描述本次處理的狀況、客戶反應..." required />
            </div>
            <div className="space-y-1.5">
              <Label>下次追蹤日期</Label>
              <Input type="date" value={logForm.nextFollowUpDate}
                onChange={e => setLogForm(p => ({ ...p, nextFollowUpDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>上傳照片/截圖</Label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400 transition-colors">
                <ImagePlus className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-muted-foreground">點擊選擇或拍照上傳</span>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                  onChange={e => setLogFiles(Array.from(e.target.files ?? []))} />
              </label>
              {logFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {logFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded border" />
                      <button type="button"
                        onClick={() => setLogFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setLogTarget(null); setLogFiles([]) }} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}新增紀錄
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 更新狀態 Dialog ── */}
      <Dialog open={!!updateTarget} onOpenChange={o => !o && setUpdateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>更新處理狀態</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            <div className="space-y-1.5">
              <Label>處理狀態</Label>
              <select className={cSel} value={updateForm.status}
                onChange={e => setUpdateForm(p => ({ ...p, status: e.target.value }))}>
                {(['OPEN','IN_PROGRESS','RESOLVED','CLOSED'] as const).map(s => (
                  <option key={s} value={s}>{complaintStatusConfig[s]?.label ?? s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>處理人員</Label>
              <Input value={updateForm.handler}
                onChange={e => setUpdateForm(p => ({ ...p, handler: e.target.value }))}
                placeholder="負責處理人員" />
            </div>
            <div className="space-y-1.5">
              <Label>處理結果說明</Label>
              <textarea className={cTa} rows={3} value={updateForm.resolution}
                onChange={e => setUpdateForm(p => ({ ...p, resolution: e.target.value }))}
                placeholder="說明如何解決或處理..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpdateTarget(null)} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}更新狀態
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

