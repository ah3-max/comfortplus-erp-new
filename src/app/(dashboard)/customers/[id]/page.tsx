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
const quotationStatusColors: Record<string, string> = {
  DRAFT: 'border-slate-200 text-slate-500', SENT: 'bg-blue-50 text-blue-600 border-blue-200',
  ACCEPTED: 'bg-green-50 text-green-600 border-green-200', REJECTED: 'bg-red-50 text-red-500 border-red-200',
  EXPIRED: 'bg-slate-50 text-slate-400 border-slate-200', CONVERTED: 'bg-purple-50 text-purple-600 border-purple-200',
}
const complaintStatusIconMap: Record<string, React.ElementType> = {
  OPEN: AlertCircle, IN_PROGRESS: Clock, RESOLVED: CheckCircle2, CLOSED: XCircle,
}
const complaintStatusClsMap: Record<string, string> = {
  OPEN: 'bg-red-50 text-red-600 border-red-200', IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-200',
  RESOLVED: 'bg-green-50 text-green-600 border-green-200', CLOSED: 'bg-slate-50 text-slate-500 border-slate-200',
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

const LOG_TYPE_COLOR: Record<string, string> = {
  CALL: 'bg-blue-100 text-blue-700', LINE: 'bg-green-100 text-green-700',
  EMAIL: 'bg-purple-100 text-purple-700', MEETING: 'bg-indigo-100 text-indigo-700',
  FIRST_VISIT: 'bg-amber-100 text-amber-700', SECOND_VISIT: 'bg-amber-100 text-amber-700',
  THIRD_VISIT: 'bg-orange-100 text-orange-700', DELIVERY: 'bg-teal-100 text-teal-700',
  EXPO: 'bg-rose-100 text-rose-700', OTHER: 'bg-slate-100 text-slate-600',
}
const LOG_TYPE_ICON: Record<string, string> = {
  CALL: '📞', LINE: '💬', EMAIL: '✉️', MEETING: '🤝',
  FIRST_VISIT: '🚪', SECOND_VISIT: '🔄', THIRD_VISIT: '⭐',
  DELIVERY: '📦', EXPO: '🏛️', OTHER: '📝',
}

const REACTION_COLOR: Record<string, string> = {
  POSITIVE: 'text-green-600', NEUTRAL: 'text-slate-500',
  NEGATIVE: 'text-red-500', NO_RESPONSE: 'text-slate-400',
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
  id: string; orderNo: string; status: string; totalAmount: string; paidAmount: string; createdAt: string
}
interface CustomerContact {
  id: string; name: string; role: string | null; title: string | null
  department: string | null; mobile: string | null; phone: string | null
  phoneExt: string | null; email: string | null; lineId: string | null
  isPrimary: boolean; preferredContactTime: string | null; notes: string | null
  // personal care fields
  gender: string | null; birthday: string | null; birthdayNote: string | null
  hasChildren: boolean | null; childrenInfo: string | null
  preferences: string | null; taboos: string | null; favoriteThings: string | null
  personalNotes: string | null; lifeEvents: string | null
}
interface Customer {
  id: string; code: string; name: string; type: string; contactPerson: string | null
  phone: string | null; lineId: string | null; email: string | null
  address: string | null; region: string | null; taxId: string | null
  paymentTerms: string | null; creditLimit: string | null; grade: string | null
  healthScore: number | null; healthLevel: string | null; healthUpdatedAt: string | null
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
  tourAutoSchedule: boolean; tourAutoAssigneeId: string | null
  tourAutoAssignee: { id: string; name: string } | null
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

const OPP_STAGE_COLOR: Record<string, string> = {
  PROSPECTING: 'bg-slate-100 text-slate-600', CONTACTED: 'bg-blue-100 text-blue-700',
  VISITED: 'bg-indigo-100 text-indigo-700', NEEDS_ANALYSIS: 'bg-purple-100 text-purple-700',
  SAMPLING: 'bg-teal-100 text-teal-700', QUOTED: 'bg-amber-100 text-amber-700',
  NEGOTIATING: 'bg-orange-100 text-orange-700', REGULAR_ORDER: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-600', INACTIVE: 'bg-slate-100 text-slate-400',
}
type ContactFormData = {
  name: string; role: string; title: string; department: string; mobile: string; phone: string
  phoneExt: string; email: string; lineId: string; isPrimary: boolean; preferredContactTime: string; notes: string
  // personal care fields
  gender: string; birthday: string; birthdayNote: string; hasChildren: string; childrenInfo: string
  preferences: string; taboos: string; favoriteThings: string; personalNotes: string; lifeEvents: string
}

interface TimelineEvent {
  id: string; eventType: string; date: string
  actor: { id: string; name: string } | null
  title: string; summary: string; meta: Record<string, unknown>
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { dict } = useI18n()
  const cu = dict.customers
  const cd = dict.customerDetail
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
  const [logDuration,    setLogDuration]     = useState('')
  const [logCompetitor,  setLogCompetitor]   = useState('')
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
  const emptyContactForm = (): ContactFormData => ({
    name: '', role: '', title: '', department: '', mobile: '', phone: '', phoneExt: '', email: '',
    lineId: '', isPrimary: false, preferredContactTime: '', notes: '',
    gender: '', birthday: '', birthdayNote: '', hasChildren: '', childrenInfo: '',
    preferences: '', taboos: '', favoriteThings: '', personalNotes: '', lifeEvents: '',
  })
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
  const [healthCalcing, setHealthCalcing] = useState(false)

  // Tour auto-schedule state
  const [tourAutoSchedule,   setTourAutoSchedule]   = useState(false)
  const [tourAutoAssigneeId, setTourAutoAssigneeId] = useState('')
  const [savingTourAuto,     setSavingTourAuto]     = useState(false)

  // Payment stats (S-14)
  const [paymentStats, setPaymentStats] = useState<{
    avgPaymentDays: number | null
    totalPayments: number
    totalAmount: number
    recentPayments: { id: string; paymentNo: string; amount: number; paymentDate: string; paymentMethod: string; orderNo: string | null }[]
  } | null>(null)

  async function recalcHealth() {
    if (!id) return
    setHealthCalcing(true)
    const res = await fetch(`/api/customers/${id}/health-score`, { method: 'POST' })
    setHealthCalcing(false)
    if (res.ok) {
      const { score, level } = await res.json()
      setCustomer(prev => prev ? { ...prev, healthScore: score, healthLevel: level, healthUpdatedAt: new Date().toISOString() } : prev)
      toast.success(dict.customerHealth.updated.replace('{score}', String(score)))
    } else {
      toast.error(dict.common.updateFailed)
    }
  }

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
      setTourAutoSchedule(Boolean(data.tourAutoSchedule))
      setTourAutoAssigneeId(data.tourAutoAssigneeId ?? '')
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
    // Fetch payment stats (S-14)
    const psRes = await fetch(`/api/customers/${id}/payment-stats`)
    if (psRes.ok) setPaymentStats(await psRes.json())
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
    if (res.ok) { toast.success(dict.common.deleteSuccess); load() }
    else toast.error(dict.common.deleteFailed)
  }

  async function handleSubmitLog() {
    if (!logContent.trim()) { toast.error(cu.interactionRequired); return }
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
        duration: logDuration ? Number(logDuration) : null,
        competitorInfo: logCompetitor || null,
      }),
    })
    setSubmittingLog(false)
    if (res.ok) {
      toast.success(cu.interactionSaved)
      setShowLogForm(false)
      setLogContent(''); setLogResult(''); setLogReaction('NEUTRAL')
      setLogNextDate(''); setLogNextAction(''); setLogHasSample(false); setLogType('CALL')
      setLogDuration(''); setLogCompetitor('')
      // Reload logs and customer
      const logsRes = await fetch(`/api/customers/${id}/followup?limit=50`)
      if (logsRes.ok) {
        const d = await logsRes.json()
        setFollowUpLogs(Array.isArray(d) ? d : (d.logs ?? []))
      }
      fetchCustomer()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? dict.common.saveFailed)
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
      toast.success(newVal ? cu.keyAccountMarked : cu.keyAccountUnmarked)
      fetchCustomer()
    } else toast.error(dict.common.operationFailed)
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
    if (res.ok) { toast.success(dict.common.saveSuccess); fetchCustomer() }
    else toast.error(dict.common.saveFailed)
  }

  async function handleSaveTourAutoSchedule() {
    if (!customer) return
    setSavingTourAuto(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tourAutoSchedule:   tourAutoSchedule,
        tourAutoAssigneeId: tourAutoAssigneeId || null,
      }),
    })
    setSavingTourAuto(false)
    if (res.ok) { toast.success(dict.common.saveSuccess); fetchCustomer() }
    else toast.error(dict.common.saveFailed)
  }

  async function handleCreateOpportunity() {
    if (!oppTitle.trim()) { toast.error(cu.opportunityTitleRequired); return }
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
      toast.success(cu.opportunityCreated)
      setShowOppForm(false)
      setOppTitle(''); setOppStage('PROSPECTING'); setOppProb('10')
      setOppAmount(''); setOppCloseDate(''); setOppNotes('')
      const oppRes = await fetch(`/api/sales-opportunities?customerId=${id}&limit=50`)
      if (oppRes.ok) setOpportunities(await oppRes.json())
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? dict.common.createFailed)
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
    { key: 'followup',   label: cd.tabs.followup,     icon: PhoneCall, badge: followUpLogs.length },
    { key: 'timeline',   label: cd.tabs.timeline,     icon: Clock },
    { key: 'info',       label: cd.tabs.info,         icon: User },
    { key: 'contacts',   label: cd.tabs.contacts,     icon: Users,         badge: customer.contacts?.length },
    { key: 'usage',      label: cd.tabs.usage,        icon: Activity },
    { key: 'delivery',   label: cd.tabs.delivery,     icon: Truck },
    { key: 'forecast',   label: cd.tabs.forecast,     icon: BarChart3 },
    { key: 'samples',    label: cd.tabs.samples,      icon: Package,       badge: customer._count.sampleRecords },
    { key: 'quotations', label: cd.tabs.quotations,   icon: FileText,      badge: customer._count.quotations },
    { key: 'orders',     label: cd.tabs.orders,       icon: ShoppingCart,  badge: customer._count.salesOrders },
    { key: 'opportunities' as TabKey, label: cd.tabs.opportunities, icon: TrendingUp, badge: opportunities.filter(o => o.isActive).length || undefined },
    { key: 'complaints', label: cd.tabs.complaints,   icon: AlertCircle,   badge: customer._count.complaintRecords, badgeRed: openComplaints > 0 },
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
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">{cd.header.keyAccount}</span>
              )}
              {!customer.isActive && <Badge variant="outline" className="text-xs border-red-200 text-red-500">{cd.header.inactive}</Badge>}
              {openComplaints > 0 && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200"><AlertCircle className="mr-1 h-3 w-3" />{cd.header.pendingComplaints.replace('{n}', String(openComplaints))}</Badge>}
              {customer.lastContactDate && (
                <span className="text-xs text-muted-foreground">
                  {cd.header.lastContact.replace('{n}', String(Math.floor((new Date().getTime() - new Date(customer.lastContactDate).getTime()) / 86400000)))}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />{dict.common.edit}{dict.common.customer}</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">{cd.summary.winRate}</p>
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
          ) : <p className="mt-1 text-lg text-muted-foreground">{cd.summary.notSet}</p>}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />{cd.summary.estimatedMonthly}</p>
          <p className="mt-1 text-xl font-bold text-blue-600">
            {customer.estimatedMonthlyVolume ? fmt(customer.estimatedMonthlyVolume) : <span className="text-lg text-muted-foreground">{cd.summary.notSet}</span>}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">{cd.summary.interactionRecords}</p>
          <p className="mt-1 text-xl font-bold text-slate-700">
            {customer._count.visitRecords + customer._count.callRecords}
          </p>
          <p className="text-xs text-muted-foreground">{cd.summary.visitCallCount.replace('{v}', String(customer._count.visitRecords)).replace('{c}', String(customer._count.callRecords))}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">{dict.customers.salesRep}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">{customer.salesRep?.name ?? dict.common.unassigned}</p>
          {customer.region && <p className="text-xs text-muted-foreground mt-0.5">{regionName}</p>}
        </div>
        {/* Health score card */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{dict.customerHealth.scoreTitle}</p>
            <button onClick={recalcHealth} disabled={healthCalcing}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50">
              {healthCalcing ? dict.customerHealth.calculating : dict.customerHealth.recalc}
            </button>
          </div>
          {customer.healthScore != null ? (() => {
            const lvl = customer.healthLevel
            const color = lvl === 'GREEN' ? '#22c55e' : lvl === 'YELLOW' ? '#f59e0b' : lvl === 'ORANGE' ? '#f97316' : lvl === 'RED' ? '#ef4444' : '#94a3b8'
            const label = lvl === 'GREEN' ? dict.customerHealth.levelHealthy : lvl === 'YELLOW' ? dict.customerHealth.levelObserve : lvl === 'ORANGE' ? dict.customerHealth.levelWarning : lvl === 'RED' ? dict.customerHealth.levelDanger : '—'
            return (
              <>
                <p className="mt-1 text-xl font-bold" style={{ color }}>{customer.healthScore}</p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${customer.healthScore}%`, backgroundColor: color }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </>
            )
          })() : (
            <p className="mt-1 text-sm text-muted-foreground">{dict.customerHealth.notCalculated}</p>
          )}
        </div>
        {/* Payment stats card (S-14) */}
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />平均付款天數
          </p>
          {paymentStats ? (
            <>
              <p className={`mt-1 text-xl font-bold ${
                paymentStats.avgPaymentDays == null ? 'text-muted-foreground'
                : paymentStats.avgPaymentDays <= 30 ? 'text-green-600'
                : paymentStats.avgPaymentDays <= 60 ? 'text-amber-600'
                : 'text-red-600'
              }`}>
                {paymentStats.avgPaymentDays != null ? `${paymentStats.avgPaymentDays} 天` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                共 {paymentStats.totalPayments} 筆 · {fmt(paymentStats.totalAmount)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">—</p>
          )}
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
                  {cd.followup.contactedCount.replace('{n}', String(followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length))}
                  {followUpLogs.filter(l => l.logType === 'CALL' || l.logType === 'LINE').length === 0 && cd.followup.notYetContacted}
                </div>
              )}

              {/* Record button */}
              <div className="flex justify-end">
                <Button onClick={() => setShowLogForm(v => !v)}>
                  <Plus className="mr-2 h-4 w-4" />{cd.followup.recordBtn}
                </Button>
              </div>

              {/* Log form */}
              {showLogForm && (
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{cd.followup.formTitle}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{cd.followup.logTypeLabel}</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={logType} onChange={e => setLogType(e.target.value)}>
                        {(Object.keys(cd.followup.logTypes) as Array<keyof typeof cd.followup.logTypes>).map(k => (
                          <option key={k} value={k}>{cd.followup.logTypes[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{cd.followup.reactionLabel}</Label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={logReaction} onChange={e => setLogReaction(e.target.value)}>
                        {(Object.keys(cd.followup.reactions) as Array<keyof typeof cd.followup.reactions>).map(k => (
                          <option key={k} value={k}>{cd.followup.reactions[k]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{cd.followup.contentLabel} <span className="text-red-500">*</span></Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={3} value={logContent} onChange={e => setLogContent(e.target.value)}
                      placeholder={cd.followup.contentPlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{cd.followup.resultLabel}</Label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2} value={logResult} onChange={e => setLogResult(e.target.value)}
                      placeholder={cd.followup.resultPlaceholder} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{cd.followup.nextDateLabel}</Label>
                      <Input type="date" value={logNextDate} onChange={e => setLogNextDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{cd.followup.nextActionLabel}</Label>
                      <Input value={logNextAction} onChange={e => setLogNextAction(e.target.value)} placeholder={cd.followup.nextActionPlaceholder} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>拜訪/通話時長（分鐘）</Label>
                      <Input type="number" min={1} value={logDuration} onChange={e => setLogDuration(e.target.value)} placeholder="15" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>競品資訊</Label>
                      <Input value={logCompetitor} onChange={e => setLogCompetitor(e.target.value)} placeholder="提及的競品或比價資訊" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="hasSample" checked={logHasSample} onChange={e => setLogHasSample(e.target.checked)} className="rounded" />
                    <Label htmlFor="hasSample" className="cursor-pointer">{cd.followup.hasSampleLabel}</Label>
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
                      {LOG_TYPE_ICON[log.logType] ?? '📝'}
                    </div>
                    <div className="bg-white border rounded-lg p-3 ml-2 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LOG_TYPE_COLOR[log.logType] ?? 'bg-slate-100 text-slate-600'}`}>
                          {(cd.logTypeLabels as Record<string, string>)[log.logType] ?? log.logType}
                        </span>
                        {log.customerReaction && (
                          <span className={`text-xs font-medium ${REACTION_COLOR[log.customerReaction] ?? 'text-slate-500'}`}>
                            {(cd.reactionLabels as Record<string, string>)[log.customerReaction] ?? log.customerReaction}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(log.logDate).toLocaleDateString('zh-TW')} · {log.createdBy.name}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{log.content}</p>
                      {log.result && <p className="text-slate-500 text-xs mt-1">{cd.followup.resultDisplay}{log.result}</p>}
                      {log.nextFollowUpDate && (
                        <p className="text-blue-600 text-xs mt-1">
                          {cd.followup.nextFollowup}{new Date(log.nextFollowUpDate).toLocaleDateString('zh-TW')}
                          {log.nextAction && ` — ${log.nextAction}`}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {log.hasSample && <span className="text-xs text-teal-600 bg-teal-50 px-1.5 rounded">{cd.followup.badgeSample}</span>}
                        {log.hasQuote  && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 rounded">{cd.followup.badgeQuote}</span>}
                        {log.hasOrder  && <span className="text-xs text-green-600 bg-green-50 px-1.5 rounded">{cd.followup.badgeOrder}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {followUpLogs.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">{cd.followup.noLogsMsg}</p>
                )}
              </div>
            </div>
          )}

          {/* ── 追蹤時間軸 ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{cd.timeline.description}</p>
                <button onClick={loadTimeline} className="text-xs text-blue-600 hover:underline">{dict.common.refresh}</button>
              </div>
              {tlLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : timeline.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">{cd.timeline.noRecords}</p>
              ) : (
                <div className="relative">
                  {/* 時間軸線 */}
                  <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-slate-200" />
                  <div className="space-y-4">
                    {timeline.map(ev => {
                      const cfgColor: Record<string, { color: string; dot: string }> = {
                        followup:  { color: 'border-blue-200 bg-blue-50',    dot: 'bg-blue-500' },
                        visit:     { color: 'border-green-200 bg-green-50',  dot: 'bg-green-500' },
                        call:      { color: 'border-indigo-200 bg-indigo-50',dot: 'bg-indigo-500' },
                        sample:    { color: 'border-violet-200 bg-violet-50',dot: 'bg-violet-500' },
                        quotation: { color: 'border-amber-200 bg-amber-50',  dot: 'bg-amber-500' },
                        order:     { color: 'border-teal-200 bg-teal-50',    dot: 'bg-teal-500' },
                        complaint: { color: 'border-red-200 bg-red-50',      dot: 'bg-red-500' },
                      }
                      const evLabel = (cd.timeline.eventLabels as Record<string, string>)[ev.eventType] ?? cd.timeline.eventLabels.default
                      const c = { ...(cfgColor[ev.eventType] ?? { color: 'border-slate-200', dot: 'bg-slate-400' }), label: evLabel }
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
                              {ev.meta.result ? <span className="text-xs bg-white/60 px-2 py-0.5 rounded border border-white/80">{cd.timeline.metaResult}{String(ev.meta.result)}</span> : null}
                              {ev.meta.hasQuote ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{cd.timeline.metaQuoted}</span> : null}
                              {ev.meta.hasSample ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{cd.timeline.metaSample}</span> : null}
                              {ev.meta.hasOrder ? <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{cd.timeline.metaOrder}</span> : null}
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{cd.info.sectionOrg}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: cd.info.orgType,   value: customerTypes.find(t => t.value === customer.type)?.label ?? customer.type },
                    { label: cd.info.orgLevel,  value: (cd.info.orgLevels as Record<string, string>)[customer.orgLevel ?? ''] },
                    { label: cd.info.bedCount,  value: customer.bedCount != null ? `${customer.bedCount}${cd.info.bedUnit}` : null },
                    { label: dict.customers.region,   value: regionName },
                    { label: cd.info.branchName, value: customer.branchName },
                    { label: cd.info.corporateFoundation, value: customer.isCorporateFoundation ? (customer.corporateFoundationName ?? dict.common.yes) : null },
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cd.info.sectionContact}</h3>
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cd.info.sectionBusiness}</h3>
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
                  {customer.notes && <><Separator /><div><p className="text-xs text-muted-foreground mb-1">{dict.common.notes}</p><p className="text-sm whitespace-pre-wrap">{customer.notes}</p></div></>}
                </div>
              </div>

              {/* 心臟客戶設定 */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⭐</span>
                    <h3 className="font-semibold text-sm text-amber-900">{cd.info.keyAccountSection}</h3>
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
                      <Label className="text-xs">{cd.info.visitFreqLabel}</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={editVisitFreq}
                        onChange={e => setEditVisitFreq(e.target.value)}
                        placeholder={cd.info.visitFreqPlaceholder}
                        min={1}
                      />
                    </div>
                    {/* relationshipScore */}
                    <div className="space-y-1">
                      <Label className="text-xs">{cd.info.relScoreLabel}</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={editRelScore}
                        onChange={e => setEditRelScore(e.target.value)}
                        placeholder={cd.info.relScorePlaceholder}
                        min={1} max={10}
                      />
                    </div>
                    {/* keyAccountMgrId */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">{cd.info.kaMgrLabel}</Label>
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editKaMgrId}
                        onChange={e => setEditKaMgrId(e.target.value)}
                      >
                        <option value="">{cd.info.kaMgrEmpty}</option>
                        {usersForKa.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    {/* keyAccountNote */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">{cd.info.kaNote}</Label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"
                        rows={2}
                        value={editKaNote}
                        onChange={e => setEditKaNote(e.target.value)}
                        placeholder={cd.info.kaNoteplaceholder}
                      />
                    </div>
                    {/* Save button */}
                    <div className="col-span-2 flex justify-end">
                      <Button size="sm" onClick={handleSaveKeyAccount} disabled={savingKa} className="h-7 text-xs">
                        {savingKa && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        {dict.common.save}{dict.customersExt.keyAccount}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 自動巡迴排程設定 */}
              {customer.grade && ['A', 'B', 'C'].includes(customer.grade) && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🗓️</span>
                      <h3 className="font-semibold text-sm text-blue-900">自動巡迴排程</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        customer.grade === 'A' ? 'bg-amber-100 text-amber-700' :
                        customer.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{customer.grade} 級</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !tourAutoSchedule
                        setTourAutoSchedule(next)
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tourAutoSchedule ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tourAutoSchedule ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {tourAutoSchedule && (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-700">
                        {customer.grade === 'A' && '📅 A 級客戶：預設每 7 天自動建立一筆巡迴排程'}
                        {customer.grade === 'B' && '📅 B 級客戶：預設每 14 天自動建立一筆巡迴排程'}
                        {customer.grade === 'C' && '📅 C 級客戶：預設每 30 天自動建立一筆巡迴排程'}
                        {customer.visitFrequencyDays && `（本客戶自訂：每 ${customer.visitFrequencyDays} 天）`}
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs">指派人員（留空則使用業務負責人）</Label>
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                          value={tourAutoAssigneeId}
                          onChange={e => setTourAutoAssigneeId(e.target.value)}
                        >
                          <option value="">使用業務負責人（{customer.salesRep?.name ?? '未設定'}）</option>
                          {usersForKa.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveTourAutoSchedule} disabled={savingTourAuto} className="h-7 text-xs">
                          {savingTourAuto && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                          儲存排程設定
                        </Button>
                      </div>
                    </div>
                  )}
                  {!tourAutoSchedule && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={handleSaveTourAutoSchedule} disabled={savingTourAuto} className="h-7 text-xs">
                        {savingTourAuto && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        儲存（關閉排程）
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
                <Button onClick={() => setVisitOpen(true)}><Plus className="mr-2 h-4 w-4" />{dict.common.add}{dict.roleDashboard.visitRecord}</Button>
              </div>
              {customer.visitRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">{dict.common.noRecords}</p>
                : customer.visitRecords.map(v => (
                <div key={v.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(v.visitDate)}</span>
                      {v.purpose && <Badge variant="outline" className="text-xs">{v.purpose}</Badge>}
                      <span className="text-xs text-muted-foreground">by {v.visitedBy.name}</span>
                    </div>
                    <button onClick={() => del('visits', v.id)} className="opacity-60 hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {v.content    && <p className="text-sm text-slate-700">{v.content}</p>}
                  {v.result     && <p className="text-sm"><span className="text-muted-foreground">{cd.visits.resultLabel}</span>{v.result}</p>}
                  {v.nextAction && <p className="text-sm text-blue-600">➤ {v.nextAction}{v.nextVisitDate && <span className="ml-2 text-muted-foreground">({fmtDate(v.nextVisitDate)})</span>}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 電訪紀錄 ── */}
          {activeTab === 'calls' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setCallOpen(true)}><Plus className="mr-2 h-4 w-4" />{dict.common.add}{dict.roleDashboard.callRecord}</Button>
              </div>
              {customer.callRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">{dict.common.noRecords}</p>
                : customer.callRecords.map(c => (
                <div key={c.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(c.callDate)}</span>
                      {c.purpose  && <Badge variant="outline" className="text-xs">{c.purpose}</Badge>}
                      {c.duration && <span className="text-xs text-muted-foreground">{c.duration}{cd.calls.durationUnit}</span>}
                      <span className="text-xs text-muted-foreground">by {c.calledBy.name}</span>
                    </div>
                    <button onClick={() => del('calls', c.id)} className="opacity-60 hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {c.content && <p className="text-sm text-slate-700">{c.content}</p>}
                  {c.result  && <p className="text-sm"><span className="text-muted-foreground">{cd.calls.resultLabel}</span>{c.result}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 樣品寄送 ── */}
          {activeTab === 'samples' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setSampleOpen(true)}><Plus className="mr-2 h-4 w-4" />{cd.samples.addBtn}</Button>
              </div>
              {customer.sampleRecords.length === 0 ? <p className="py-10 text-center text-muted-foreground">{dict.common.noRecords}</p>
                : customer.sampleRecords.map(s => (
                <div key={s.id} className="rounded-lg border p-4 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmtDate(s.sentDate)}</span>
                      <span className="text-xs text-muted-foreground">by {s.sentBy.name}</span>
                      {s.trackingNo && <Badge variant="outline" className="text-xs font-mono">{s.trackingNo}</Badge>}
                    </div>
                    <button onClick={() => del('samples', s.id)} className="opacity-60 hover:opacity-100 rounded p-1 hover:bg-red-50 text-red-400 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-sm font-medium">{s.items}</p>
                  {s.recipient      && <p className="text-sm text-muted-foreground">{cd.samples.recipientLabel}{s.recipient}</p>}
                  {s.followUpDate   && <p className="text-sm text-amber-600">{cd.samples.followUpDateLabel}{fmtDate(s.followUpDate)}</p>}
                  {s.followUpResult && <p className="text-sm"><span className="text-muted-foreground">{cd.samples.followUpResultLabel}</span>{s.followUpResult}</p>}
                  {s.notes          && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 報價紀錄 ── */}
          {activeTab === 'quotations' && (
            <div className="space-y-3">
              {customer.quotations.length === 0 ? <p className="py-10 text-center text-muted-foreground">{dict.common.noRecords}</p>
                : customer.quotations.map(q => (
                <div key={q.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/quotations/${q.id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{q.quotationNo}</span>
                    <Badge variant="outline" className={`text-xs ${quotationStatusColors[q.status] ?? ''}`}>{(cd.quotations.statusLabels as Record<string, string>)[q.status] ?? q.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{fmt(q.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(q.createdAt)}</span>
                    {q.validUntil && <span className="text-xs text-muted-foreground">{cd.quotations.validUntil}{fmtDate(q.validUntil)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 訂單紀錄 ── */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {/* S-13: AR aging mini-card */}
              {(() => {
                const unpaidOrders = customer.salesOrders.filter(o =>
                  !['CANCELLED', 'DRAFT'].includes(o.status) &&
                  Number(o.totalAmount) > Number(o.paidAmount ?? 0)
                )
                const totalUnpaid = unpaidOrders.reduce((s, o) => s + Number(o.totalAmount) - Number(o.paidAmount ?? 0), 0)
                const overdueCount = unpaidOrders.filter(o => {
                  const daysAgo = (Date.now() - new Date(o.createdAt).getTime()) / 86400000
                  return daysAgo > 30
                }).length
                if (unpaidOrders.length === 0) return null
                return (
                  <div className={`rounded-lg border p-3 flex items-center justify-between ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div>
                      <div className="text-xs font-medium text-gray-500">應收帳款</div>
                      <div className={`text-base font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-amber-700'}`}>{fmt(String(totalUnpaid))}</div>
                    </div>
                    <div className="text-right">
                      {overdueCount > 0 && (
                        <div className="text-xs font-medium text-red-600">⚠ {overdueCount} 筆逾期 30 天</div>
                      )}
                      <div className="text-xs text-gray-500">{unpaidOrders.length} 筆待收款</div>
                    </div>
                  </div>
                )
              })()}
              {/* S-14: Payment stats mini-section */}
              {paymentStats && paymentStats.totalPayments > 0 && (
                <div className="rounded-lg border bg-green-50/50 border-green-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-green-800">收款紀錄</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      paymentStats.avgPaymentDays == null ? 'bg-slate-100 text-slate-600'
                      : paymentStats.avgPaymentDays <= 30 ? 'bg-green-100 text-green-700'
                      : paymentStats.avgPaymentDays <= 60 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      平均 {paymentStats.avgPaymentDays ?? '—'} 天收款
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {paymentStats.recentPayments.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-mono">{p.paymentNo}</span>
                        {p.orderNo && <span className="text-slate-500">← {p.orderNo}</span>}
                        <span className="font-medium text-green-700">{fmt(p.amount)}</span>
                        <span className="text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString('zh-TW')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {customer.salesOrders.length === 0 ? <p className="py-10 text-center text-muted-foreground">{dict.common.noRecords}</p>
                : customer.salesOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{o.orderNo}</span>
                    <Badge variant="outline" className="text-xs">{(cd.quotations.orderStatusLabels as Record<string, string>)[o.status] ?? o.status}</Badge>
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
                  {cd.opportunities.activeCount.replace('{n}', String(opportunities.filter(o => o.isActive).length))}
                </p>
                <Button size="sm" onClick={() => setShowOppForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {cd.opportunities.addBtn}
                </Button>
              </div>

              {/* Create form */}
              {showOppForm && (
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{cd.opportunities.formTitle}</p>
                    <button onClick={() => setShowOppForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{cd.opportunities.titleLabel}</Label>
                      <Input className="h-8 text-sm" value={oppTitle} onChange={e => setOppTitle(e.target.value)} placeholder={cd.opportunities.titlePlaceholder} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{cd.opportunities.stageLabel}</Label>
                      <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={oppStage} onChange={e => setOppStage(e.target.value)}>
                        {(Object.keys(OPP_STAGE_COLOR) as Array<keyof typeof cd.opportunities.stageLabels>).map(k => (
                          <option key={k} value={k}>{(cd.opportunities.stageLabels as Record<string, string>)[k] ?? k}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{cd.opportunities.probLabel}</Label>
                      <Input type="number" className="h-8 text-sm" value={oppProb}
                        onChange={e => setOppProb(e.target.value)} min={0} max={100} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{cd.opportunities.amountLabel}</Label>
                      <Input type="number" className="h-8 text-sm" value={oppAmount}
                        onChange={e => setOppAmount(e.target.value)} placeholder={cd.opportunities.amountPlaceholder} min={0} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{cd.opportunities.closeDateLabel}</Label>
                      <Input type="date" className="h-8 text-sm" value={oppCloseDate}
                        onChange={e => setOppCloseDate(e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{cd.opportunities.notesLabel}</Label>
                      <Input className="h-8 text-sm" value={oppNotes}
                        onChange={e => setOppNotes(e.target.value)} placeholder={cd.opportunities.notesPlaceholder} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setShowOppForm(false)}>{dict.common.cancel}</Button>
                    <Button size="sm" onClick={handleCreateOpportunity} disabled={savingOpp}>
                      {savingOpp && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {cd.opportunities.createBtn}
                    </Button>
                  </div>
                </div>
              )}

              {/* Opportunity list */}
              {opportunities.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {cd.opportunities.noRecords}
                </div>
              ) : (
                <div className="space-y-2">
                  {opportunities.map(opp => {
                    const stageColor = OPP_STAGE_COLOR[opp.stage] ?? 'bg-slate-100 text-slate-600'
                    const stageLabel = (cd.opportunities.stageLabels as Record<string, string>)[opp.stage] ?? opp.stage
                    const sc = { color: stageColor, label: stageLabel }
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
                                <span>{cd.opportunities.expectedLabel}{new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(Number(opp.expectedAmount))}</span>
                              )}
                              {opp.expectedCloseDate && (
                                <span>{cd.opportunities.expectedDateLabel}{new Date(opp.expectedCloseDate).toLocaleDateString('zh-TW')}</span>
                              )}
                              {opp.owner && <span>{cd.opportunities.ownerLabel}{opp.owner.name}</span>}
                              <span>{cd.opportunities.interactCount.replace('{n}', String(opp._count.followUpLogs))}</span>
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
          <DialogHeader><DialogTitle>{cd.visits.dialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('visits', visitForm); if (res.ok) { toast.success(dict.common.createSuccess); setVisitOpen(false); setVisitForm({ visitDate: new Date().toISOString().slice(0,10), purpose: '', content: '', result: '', nextAction: '', nextVisitDate: '' }); load() } else toast.error(dict.common.saveFailed) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{cd.visits.visitDateLabel}</Label><Input type="date" value={visitForm.visitDate} onChange={e => setVisitForm(p => ({ ...p, visitDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>{cd.visits.purposeLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={visitForm.purpose} onChange={e => setVisitForm(p => ({ ...p, purpose: e.target.value }))}>
                  <option value="">{cd.visits.purposeEmpty}</option>{(cd.visits.purposes as readonly string[]).map((p: string) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>{cd.visits.contentLabel}</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={3} value={visitForm.content} onChange={e => setVisitForm(p => ({ ...p, content: e.target.value }))} placeholder={cd.visits.contentPlaceholder} /></div>
            <div className="space-y-1.5"><Label>{cd.visits.resultFormLabel}</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} value={visitForm.result} onChange={e => setVisitForm(p => ({ ...p, result: e.target.value }))} placeholder={cd.visits.resultPlaceholder} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{cd.visits.nextActionLabel}</Label><Input value={visitForm.nextAction} onChange={e => setVisitForm(p => ({ ...p, nextAction: e.target.value }))} placeholder={cd.visits.nextActionPlaceholder} /></div>
              <div className="space-y-1.5"><Label>{cd.visits.nextDateLabel}</Label><Input type="date" value={visitForm.nextVisitDate} onChange={e => setVisitForm(p => ({ ...p, nextVisitDate: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVisitOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 電訪 Dialog ── */}
      <Dialog open={callOpen} onOpenChange={o => !o && setCallOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{cd.calls.dialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('calls', callForm); if (res.ok) { toast.success(dict.common.createSuccess); setCallOpen(false); setCallForm({ callDate: new Date().toISOString().slice(0,10), duration: '', purpose: '', content: '', result: '' }); load() } else toast.error(dict.common.saveFailed) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{cd.calls.callDateLabel}</Label><Input type="date" value={callForm.callDate} onChange={e => setCallForm(p => ({ ...p, callDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>{cd.calls.durationLabel}</Label><Input type="number" value={callForm.duration} onChange={e => setCallForm(p => ({ ...p, duration: e.target.value }))} placeholder="5" min={1} /></div>
            </div>
            <div className="space-y-1.5"><Label>{cd.calls.purposeLabel}</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={callForm.purpose} onChange={e => setCallForm(p => ({ ...p, purpose: e.target.value }))}>
                <option value="">{cd.calls.purposeEmpty}</option>{(cd.calls.purposes as readonly string[]).map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>{cd.calls.contentLabel}</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={3} value={callForm.content} onChange={e => setCallForm(p => ({ ...p, content: e.target.value }))} placeholder={cd.calls.contentPlaceholder} /></div>
            <div className="space-y-1.5"><Label>{cd.calls.resultFormLabel}</Label><Input value={callForm.result} onChange={e => setCallForm(p => ({ ...p, result: e.target.value }))} placeholder={cd.calls.resultPlaceholder} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCallOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 樣品 Dialog ── */}
      <Dialog open={sampleOpen} onOpenChange={o => !o && setSampleOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{cd.samples.dialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={async e => { e.preventDefault(); const res = await post('samples', sampleForm); if (res.ok) { toast.success(dict.common.createSuccess); setSampleOpen(false); setSampleForm({ sentDate: new Date().toISOString().slice(0,10), items: '', trackingNo: '', recipient: '', followUpDate: '', notes: '' }); load() } else toast.error(dict.common.saveFailed) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{cd.samples.sentDateLabel}</Label><Input type="date" value={sampleForm.sentDate} onChange={e => setSampleForm(p => ({ ...p, sentDate: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>{cd.samples.recipientFormLabel}</Label><Input value={sampleForm.recipient} onChange={e => setSampleForm(p => ({ ...p, recipient: e.target.value }))} placeholder={cd.samples.recipientPlaceholder} /></div>
            </div>
            <div className="space-y-1.5"><Label>{cd.samples.itemsLabel}</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} value={sampleForm.items} onChange={e => setSampleForm(p => ({ ...p, items: e.target.value }))} placeholder={cd.samples.itemsPlaceholder} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{cd.samples.trackingNoLabel}</Label><Input value={sampleForm.trackingNo} onChange={e => setSampleForm(p => ({ ...p, trackingNo: e.target.value }))} placeholder={cd.samples.trackingNoPlaceholder} /></div>
              <div className="space-y-1.5"><Label>{cd.samples.followUpDateFormLabel}</Label><Input type="date" value={sampleForm.followUpDate} onChange={e => setSampleForm(p => ({ ...p, followUpDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>{cd.samples.notesLabel}</Label><Input value={sampleForm.notes} onChange={e => setSampleForm(p => ({ ...p, notes: e.target.value }))} placeholder={cd.samples.notesPlaceholder} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSampleOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}</Button>
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
  const { dict } = useI18n()
  const cd = dict.customerDetail
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
    if (res.ok) toast.success(dict.common.saveSuccess)
    else toast.error(dict.common.saveFailed)
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
        <SectionTitle>{cd.usage.sectionBed}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.usage.totalBeds}</Label>
            <Input type="number" min={0} value={form.totalBeds} onChange={e => setField('totalBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.occupiedBeds}</Label>
            <Input type="number" min={0} value={form.occupiedBeds} onChange={e => setField('occupiedBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.vacantBeds}</Label>
            <Input type="number" min={0} value={form.vacantBeds} onChange={e => setField('vacantBeds', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>{cd.usage.residentCareNote}</Label>
            <Input value={form.residentCareNote} onChange={e => setField('residentCareNote', e.target.value)} placeholder={cd.usage.residentCareNotePlaceholder} />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 外籍照護 ── */}
      <div>
        <SectionTitle>{cd.usage.sectionForeign}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.usage.foreignRatio}</Label>
            <Input type="number" min={0} max={100} value={form.foreignCaregiverRatio} onChange={e => setField('foreignCaregiverRatio', e.target.value)} placeholder={cd.usage.foreignRatioPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.foreignCountry}</Label>
            <select className={sel} value={form.foreignCaregiverCountry} onChange={e => setField('foreignCaregiverCountry', e.target.value)}>
              <option value="">{cd.usage.selectPlaceholder}</option>
              {(Object.keys(cd.usage.foreignCountryLabels) as Array<keyof typeof cd.usage.foreignCountryLabels>).map(v => <option key={v} value={v}>{cd.usage.foreignCountryLabels[v]}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 品牌與採購 ── */}
      <div>
        <SectionTitle>{cd.usage.sectionBrand}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.usage.mgmtQuality}</Label>
            <select className={sel} value={form.managementQuality} onChange={e => setField('managementQuality', e.target.value)}>
              <option value="">{cd.usage.selectPlaceholder}</option>
              {(Object.keys(cd.usage.mgmtQualityLabels) as Array<keyof typeof cd.usage.mgmtQualityLabels>).map(v => <option key={v} value={v}>{cd.usage.mgmtQualityLabels[v]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.brandSwitchFreq}</Label>
            <select className={sel} value={form.brandSwitchFreq} onChange={e => setField('brandSwitchFreq', e.target.value)}>
              <option value="">{cd.usage.selectPlaceholder}</option>
              {(Object.keys(cd.usage.brandSwitchLabels) as Array<keyof typeof cd.usage.brandSwitchLabels>).map(v => <option key={v} value={v}>{cd.usage.brandSwitchLabels[v]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.currentBrands}</Label>
            <Input value={form.currentBrands} onChange={e => setField('currentBrands', e.target.value)} placeholder={cd.usage.currentBrandsPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.competitorBrands}</Label>
            <Input value={form.competitorBrands} onChange={e => setField('competitorBrands', e.target.value)} placeholder={cd.usage.competitorBrandsPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.easySwitchBrand}</Label>
            <select className={sel} value={form.easySwitchBrand} onChange={e => setField('easySwitchBrand', e.target.value)}>
              <option value="">{cd.usage.easySwitchUnknown}</option>
              <option value="true">{cd.usage.easySwitchYes}</option>
              <option value="false">{cd.usage.easySwitchNo}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.usage.procurementStyle}</Label>
            <select className={sel} value={form.procurementStyle} onChange={e => setField('procurementStyle', e.target.value)}>
              <option value="">{cd.usage.selectPlaceholder}</option>
              {(Object.keys(cd.usage.procurementStyleLabels) as Array<keyof typeof cd.usage.procurementStyleLabels>).map(v => <option key={v} value={v}>{cd.usage.procurementStyleLabels[v]}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 每日用量 ── */}
      <div>
        <SectionTitle>{cd.usage.sectionDaily}</SectionTitle>
        <div className="mb-3 flex items-center gap-3">
          <Label className="text-sm font-normal">{cd.usage.usesWipesLabel}</Label>
          <button type="button" onClick={() => setField('usesWipes', !form.usesWipes)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.usesWipes ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.usesWipes ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { field: 'dailyDiaperLargeQty' as keyof UsageForm, label: cd.usage.dailyDiaperLarge },
            { field: 'dailyDiaperSmallQty' as keyof UsageForm, label: cd.usage.dailyDiaperSmall },
            { field: 'dailyUnderpadsQty'   as keyof UsageForm, label: cd.usage.dailyUnderpads },
            { field: 'dailyWipesQty'       as keyof UsageForm, label: cd.usage.dailyWipes, disabled: !form.usesWipes },
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
          <SectionTitle>{cd.usage.sectionMonthly}</SectionTitle>
          <span className="text-xs text-muted-foreground -mt-3">{cd.usage.monthlyHint}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { field: 'monthlyDiaperLargeQty' as keyof UsageForm, label: cd.usage.monthlyDiaperLarge },
            { field: 'monthlyDiaperSmallQty' as keyof UsageForm, label: cd.usage.monthlyDiaperSmall },
            { field: 'monthlyUnderpadsQty'   as keyof UsageForm, label: cd.usage.monthlyUnderpads },
            { field: 'monthlyWipesQty'       as keyof UsageForm, label: cd.usage.monthlyWipes, disabled: !form.usesWipes },
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
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.usage.saveBtn}
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// ContactsTab component
// ═══════════════════════════════════════════════════════════

const CONTACT_ROLE_COLOR: Record<string, string> = {
  PURCHASING: 'bg-blue-100 text-blue-700', DIRECTOR: 'bg-purple-100 text-purple-700',
  HEAD_NURSE: 'bg-pink-100 text-pink-700', ACCOUNTING: 'bg-green-100 text-green-700',
  ADMIN: 'bg-slate-100 text-slate-600', OWNER: 'bg-amber-100 text-amber-700',
  WAREHOUSE: 'bg-orange-100 text-orange-700', RECEIVING: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-slate-100 text-slate-500',
}

interface ContactsTabProps {
  contacts: CustomerContact[]; customerId: string
  contactOpen: boolean; setContactOpen: (v: boolean) => void
  editContact: CustomerContact | null; setEditContact: (c: CustomerContact | null) => void
  contactForm: ContactFormData; setContactForm: (f: ContactFormData) => void
  emptyContactForm: () => ContactFormData
  saving: boolean; setSaving: (v: boolean) => void; reload: () => void
}

function ContactsTab({ contacts, customerId, contactOpen, setContactOpen, editContact, setEditContact, contactForm, setContactForm, emptyContactForm, saving, setSaving, reload }: ContactsTabProps) {
  const { dict } = useI18n()
  const cd = dict.customerDetail
  const contactRoles = (Object.keys(cd.contacts.roleLabels) as Array<keyof typeof cd.contacts.roleLabels>).map(value => ({ value, label: cd.contacts.roleLabels[value] }))
  const contactTimes = (Object.keys(cd.contacts.timeLabels) as Array<keyof typeof cd.contacts.timeLabels>).map(value => ({ value, label: cd.contacts.timeLabels[value] }))
  const CONTACT_ROLE_LABEL = cd.contacts.roleLabels as Record<string, string>
  const CONTACT_TIME_LABEL = cd.contacts.timeLabels as Record<string, string>

  // ── 溫馨備注 dialog state ──
  type WarmNoteForm = {
    gender: string; birthday: string; birthdayNote: string
    hasChildren: string; childrenInfo: string; preferences: string
    taboos: string; favoriteThings: string; personalNotes: string; lifeEvents: string
  }
  const [warmEditContact, setWarmEditContact] = useState<CustomerContact | null>(null)
  const [warmForm, setWarmForm] = useState<WarmNoteForm>({ gender: '', birthday: '', birthdayNote: '', hasChildren: '', childrenInfo: '', preferences: '', taboos: '', favoriteThings: '', personalNotes: '', lifeEvents: '' })
  const [savingWarm, setSavingWarm] = useState(false)

  function openWarmEdit(c: CustomerContact) {
    setWarmEditContact(c)
    setWarmForm({
      gender: c.gender ?? '', birthday: c.birthday ? c.birthday.slice(0, 10) : '',
      birthdayNote: c.birthdayNote ?? '',
      hasChildren: c.hasChildren == null ? '' : c.hasChildren ? 'true' : 'false',
      childrenInfo: c.childrenInfo ?? '', preferences: c.preferences ?? '',
      taboos: c.taboos ?? '', favoriteThings: c.favoriteThings ?? '',
      personalNotes: c.personalNotes ?? '', lifeEvents: c.lifeEvents ?? '',
    })
  }

  async function saveWarmNote(e: React.FormEvent) {
    e.preventDefault()
    if (!warmEditContact) return
    setSavingWarm(true)
    const res = await fetch(`/api/customers/${customerId}/contacts/${warmEditContact.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: warmForm.gender || null, birthday: warmForm.birthday || null,
        birthdayNote: warmForm.birthdayNote || null, hasChildren: warmForm.hasChildren,
        childrenInfo: warmForm.childrenInfo || null, preferences: warmForm.preferences || null,
        taboos: warmForm.taboos || null, favoriteThings: warmForm.favoriteThings || null,
        personalNotes: warmForm.personalNotes || null, lifeEvents: warmForm.lifeEvents || null,
      }),
    })
    setSavingWarm(false)
    if (res.ok) { toast.success(dict.customerDetail.contacts.warmNotesSaved); setWarmEditContact(null); reload() }
    else toast.error(dict.common.saveFailed)
  }

  function openNew() { setEditContact(null); setContactForm(emptyContactForm()); setContactOpen(true) }
  function openEdit(c: CustomerContact) {
    setEditContact(c)
    setContactForm({
      name: c.name, role: c.role ?? '', title: c.title ?? '',
      department: c.department ?? '', mobile: c.mobile ?? '',
      phone: c.phone ?? '', phoneExt: c.phoneExt ?? '',
      email: c.email ?? '', lineId: c.lineId ?? '',
      isPrimary: c.isPrimary, preferredContactTime: c.preferredContactTime ?? '', notes: c.notes ?? '',
      gender: c.gender ?? '', birthday: c.birthday ? c.birthday.slice(0, 10) : '',
      birthdayNote: c.birthdayNote ?? '',
      hasChildren: c.hasChildren === true ? 'true' : c.hasChildren === false ? 'false' : '',
      childrenInfo: c.childrenInfo ?? '', preferences: c.preferences ?? '',
      taboos: c.taboos ?? '', favoriteThings: c.favoriteThings ?? '',
      personalNotes: c.personalNotes ?? '', lifeEvents: c.lifeEvents ?? '',
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
    if (!confirm(cd.contacts.deleteConfirm)) return
    await fetch(`/api/customers/${customerId}/contacts?contactId=${contactId}`, { method: 'DELETE' })
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />{cd.contacts.addBtn}</Button>
      </div>

      {contacts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{cd.contacts.noContacts}</p>
          <p className="text-xs mt-1">{cd.contacts.noContactsHint}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map(c => (
            <div key={c.id} className={`rounded-lg border p-4 relative ${c.isPrimary ? 'border-blue-300 bg-blue-50/30' : 'bg-white'}`}>
              {c.isPrimary && (
                <span className="absolute top-3 right-10 text-xs font-medium text-blue-600 flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-blue-500 text-blue-500" />{cd.contacts.primaryLabel}
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
                    {c.mobile && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Phone className="h-3 w-3 text-slate-400" />{c.mobile}{cd.contacts.mobileLabel}</p>}
                    {c.phone && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Phone className="h-3 w-3 text-slate-400" />{c.phone}{c.phoneExt && `${cd.contacts.extPrefix}${c.phoneExt}`}{cd.contacts.phoneLabel}</p>}
                    {c.lineId && <p className="text-xs flex items-center gap-1.5 text-slate-700"><MessageCircle className="h-3 w-3 text-slate-400" />LINE: {c.lineId}</p>}
                    {c.email && <p className="text-xs flex items-center gap-1.5 text-slate-700"><Mail className="h-3 w-3 text-slate-400" />{c.email}</p>}
                    {c.preferredContactTime && (
                      <p className="text-xs flex items-center gap-1.5 text-blue-600">
                        <Clock className="h-3 w-3" />{cd.contacts.preferredTimePrefix}{CONTACT_TIME_LABEL[c.preferredContactTime] ?? c.preferredContactTime}
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
              {/* 溫馨備注 */}
              <details className="mt-3 border-t border-dashed border-pink-100 pt-2">
                <summary className="text-xs text-pink-500 cursor-pointer select-none font-medium hover:text-pink-700">
                  {cd.contacts.warmNotesTitle} ▼{(c.gender || c.birthday || c.preferences || c.taboos || c.favoriteThings || c.personalNotes || c.lifeEvents || c.hasChildren != null) && <span className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-pink-400 align-middle" />}
                </summary>
                <div className="mt-2 space-y-1">
                  {c.gender     && <p className="text-xs text-slate-600">{cd.contacts.genderDisplay}{c.gender === 'M' ? cd.contacts.genderMale : c.gender === 'F' ? cd.contacts.genderFemale : cd.contacts.genderOther}</p>}
                  {c.birthday   && <p className="text-xs text-slate-600">{cd.contacts.birthdayDisplay}{c.birthday.slice(5, 10)}{c.birthdayNote && `（${c.birthdayNote}）`}</p>}
                  {c.hasChildren != null && <p className="text-xs text-slate-600">{cd.contacts.hasChildrenDisplay}{c.hasChildren ? `${cd.contacts.hasChildrenWithInfo}${c.childrenInfo ? `（${c.childrenInfo}）` : ''}` : cd.contacts.hasChildrenNo}</p>}
                  {c.preferences    && <p className="text-xs text-slate-600">{cd.contacts.preferencesSuffix}{c.preferences}</p>}
                  {c.taboos         && <p className="text-xs text-red-500">{cd.contacts.taboosSuffix}{c.taboos}</p>}
                  {c.favoriteThings && <p className="text-xs text-slate-600">{cd.contacts.favoriteThingsSuffix}{c.favoriteThings}</p>}
                  {c.personalNotes  && <p className="text-xs text-pink-700 italic">{cd.contacts.personalNotesSuffix}{c.personalNotes}</p>}
                  {c.lifeEvents     && <p className="text-xs text-slate-500">{cd.contacts.lifeEventsSuffix}{c.lifeEvents}</p>}
                  {!(c.gender || c.birthday || c.preferences || c.taboos || c.favoriteThings || c.personalNotes || c.lifeEvents || c.hasChildren != null) && (
                    <p className="text-xs text-muted-foreground">{cd.contacts.warmNotesEmpty}</p>
                  )}
                  <button type="button" onClick={() => openWarmEdit(c)}
                    className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200">
                    <Pencil className="h-3 w-3" />{cd.contacts.warmNotesEditBtn}
                  </button>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={o => !o && setContactOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editContact ? cd.contacts.dialogTitleEdit : cd.contacts.dialogTitleNew}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.nameLabel}</Label>
                <Input value={contactForm.name as string} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder={cd.contacts.namePlaceholder} required />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.roleLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.role as string} onChange={e => setContactForm({ ...contactForm, role: e.target.value })}>
                  <option value="">{cd.contacts.roleEmpty}</option>
                  {contactRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.titleLabel}</Label>
                <Input value={contactForm.title as string} onChange={e => setContactForm({ ...contactForm, title: e.target.value })} placeholder={cd.contacts.titlePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.deptLabel}</Label>
                <Input value={contactForm.department as string} onChange={e => setContactForm({ ...contactForm, department: e.target.value })} placeholder={cd.contacts.deptPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.mobileFormLabel}</Label>
                <Input value={contactForm.mobile as string} onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })} placeholder={cd.contacts.mobilePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.phoneFormLabel}</Label>
                <div className="flex gap-2">
                  <Input value={contactForm.phone as string} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder={cd.contacts.phonePlaceholder} className="flex-1" />
                  <Input value={contactForm.phoneExt as string} onChange={e => setContactForm({ ...contactForm, phoneExt: e.target.value })} placeholder={cd.contacts.extPlaceholder} className="w-20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.lineLabel}</Label>
                <Input value={contactForm.lineId as string} onChange={e => setContactForm({ ...contactForm, lineId: e.target.value })} placeholder={cd.contacts.linePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.emailLabel}</Label>
                <Input type="email" value={contactForm.email as string} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder={cd.contacts.emailPlaceholder} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.preferredTimeLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.preferredContactTime as string} onChange={e => setContactForm({ ...contactForm, preferredContactTime: e.target.value })}>
                  <option value="">{cd.contacts.preferredTimeEmpty}</option>
                  {contactTimes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div><p className="text-sm font-medium">{cd.contacts.isPrimaryLabel}</p><p className="text-xs text-muted-foreground">{cd.contacts.isPrimaryHint}</p></div>
                  <button type="button" onClick={() => setContactForm({ ...contactForm, isPrimary: !contactForm.isPrimary })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${contactForm.isPrimary ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${contactForm.isPrimary ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.notesLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={contactForm.notes as string} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} placeholder={cd.contacts.notesPlaceholder} />
              </div>
              {/* ── 溫馨備注（業務拜訪用） ── */}
              <div className="col-span-2">
                <p className="text-xs font-semibold text-pink-600 mb-2 mt-1 border-t pt-3">{cd.contacts.warmNotesSectionLabel}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.genderLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.gender} onChange={e => setContactForm({ ...contactForm, gender: e.target.value })}>
                  <option value="">{cd.contacts.genderUnset}</option>
                  <option value="M">{cd.contacts.genderMale}</option>
                  <option value="F">{cd.contacts.genderFemale}</option>
                  <option value="OTHER">{cd.contacts.genderOther}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.birthdayLabel}</Label>
                <Input type="date" value={contactForm.birthday} onChange={e => setContactForm({ ...contactForm, birthday: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.birthdayNoteLabel}</Label>
                <Input value={contactForm.birthdayNote} onChange={e => setContactForm({ ...contactForm, birthdayNote: e.target.value })} placeholder={cd.contacts.birthdayNotePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.contacts.hasChildrenLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contactForm.hasChildren} onChange={e => setContactForm({ ...contactForm, hasChildren: e.target.value })}>
                  <option value="">{cd.contacts.hasChildrenUnset}</option>
                  <option value="true">{cd.contacts.hasChildrenYes}</option>
                  <option value="false">{cd.contacts.hasChildrenNo}</option>
                </select>
              </div>
              {contactForm.hasChildren === 'true' && (
                <div className="col-span-2 space-y-1.5">
                  <Label>{cd.contacts.childrenInfoLabel}</Label>
                  <Input value={contactForm.childrenInfo} onChange={e => setContactForm({ ...contactForm, childrenInfo: e.target.value })} placeholder={cd.contacts.childrenInfoPlaceholder} />
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.preferencesLabel}</Label>
                <Input value={contactForm.preferences} onChange={e => setContactForm({ ...contactForm, preferences: e.target.value })} placeholder={cd.contacts.preferencesFormPlaceholder} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.taboosLabel}</Label>
                <Input value={contactForm.taboos} onChange={e => setContactForm({ ...contactForm, taboos: e.target.value })} placeholder={cd.contacts.taboosFormPlaceholder} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.favoriteThingsLabel}</Label>
                <Input value={contactForm.favoriteThings} onChange={e => setContactForm({ ...contactForm, favoriteThings: e.target.value })} placeholder={cd.contacts.favoriteThingsFormPlaceholder} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.personalNotesLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={contactForm.personalNotes} onChange={e => setContactForm({ ...contactForm, personalNotes: e.target.value })} placeholder={cd.contacts.personalNotesFormPlaceholder} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{cd.contacts.lifeEventsLabel}</Label>
                <Input value={contactForm.lifeEvents} onChange={e => setContactForm({ ...contactForm, lifeEvents: e.target.value })} placeholder={cd.contacts.lifeEventsFormPlaceholder} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving || !contactForm.name}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 溫馨備注 edit Dialog ── */}
      <Dialog open={!!warmEditContact} onOpenChange={o => !o && setWarmEditContact(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cd.contacts.warmDialogTitle} {warmEditContact?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveWarmNote} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{cd.contacts.genderLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={warmForm.gender} onChange={e => setWarmForm({ ...warmForm, gender: e.target.value })}>
                  <option value="">{cd.contacts.genderUnset}</option><option value="M">{cd.contacts.genderMale}</option><option value="F">{cd.contacts.genderFemale}</option><option value="OTHER">{cd.contacts.genderOther}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{cd.contacts.hasChildrenLabel}</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={warmForm.hasChildren} onChange={e => setWarmForm({ ...warmForm, hasChildren: e.target.value })}>
                  <option value="">{cd.contacts.hasChildrenUnset}</option><option value="true">{cd.contacts.hasChildrenYes}</option><option value="false">{cd.contacts.hasChildrenNo}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{cd.contacts.birthdayLabel}</Label>
                <Input type="date" className="text-sm" value={warmForm.birthday} onChange={e => setWarmForm({ ...warmForm, birthday: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{cd.contacts.birthdayNoteDialogLabel}</Label>
                <Input className="text-sm" placeholder={cd.contacts.birthdayNotePlaceholderDialog} value={warmForm.birthdayNote} onChange={e => setWarmForm({ ...warmForm, birthdayNote: e.target.value })} />
              </div>
              {warmForm.hasChildren === 'true' && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">{cd.contacts.childrenInfoDialogLabel}</Label>
                  <Input className="text-sm" placeholder={cd.contacts.childrenInfoPlaceholderDialog} value={warmForm.childrenInfo} onChange={e => setWarmForm({ ...warmForm, childrenInfo: e.target.value })} />
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{cd.contacts.preferencesDlgLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} placeholder={cd.contacts.preferencesDlgPlaceholder} value={warmForm.preferences} onChange={e => setWarmForm({ ...warmForm, preferences: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{cd.contacts.taboosDlgLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} placeholder={cd.contacts.taboosDlgPlaceholder} value={warmForm.taboos} onChange={e => setWarmForm({ ...warmForm, taboos: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{cd.contacts.favoriteThingsDlgLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} placeholder={cd.contacts.favoriteThingsDlgPlaceholder} value={warmForm.favoriteThings} onChange={e => setWarmForm({ ...warmForm, favoriteThings: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{cd.contacts.lifeEventsDlgLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} placeholder={cd.contacts.lifeEventsDlgPlaceholder} value={warmForm.lifeEvents} onChange={e => setWarmForm({ ...warmForm, lifeEvents: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{cd.contacts.personalNotesLabel}</Label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={3} placeholder={cd.contacts.personalNotesDlgPlaceholder} value={warmForm.personalNotes} onChange={e => setWarmForm({ ...warmForm, personalNotes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWarmEditContact(null)} disabled={savingWarm}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={savingWarm}>
                {savingWarm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{dict.common.save}
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
  parkingNotes: string; parkingSpot: string; parkingFee: string
  elevatorDimensions: string; elevatorMaxWeight: string; elevatorNotes: string
  routeNotes: string; driverNotes: string
  receiverName: string; receiverPhone: string; deliveryNotes: string
  photoUrls: PhotoEntry[]
}


function emptyDeliveryForm(): DeliveryForm {
  return {
    deliveryAddress: '', unloadingLocation: '', unloadingFloor: '',
    hasElevator: '', needsCart: '', hasReception: '',
    receivingHours: '', suggestedDeliveryTime: '',
    parkingNotes: '', parkingSpot: '', parkingFee: '',
    elevatorDimensions: '', elevatorMaxWeight: '', elevatorNotes: '',
    routeNotes: '', driverNotes: '',
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
    parkingNotes: s(p.parkingNotes), parkingSpot: s(p.parkingSpot), parkingFee: s(p.parkingFee),
    elevatorDimensions: s(p.elevatorDimensions), elevatorMaxWeight: s(p.elevatorMaxWeight),
    elevatorNotes: s(p.elevatorNotes), routeNotes: s(p.routeNotes), driverNotes: s(p.driverNotes),
    receiverName: s(p.receiverName), receiverPhone: s(p.receiverPhone),
    deliveryNotes: s(p.deliveryNotes),
    photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
  }
}

function DeliveryProfileTab({ customerId }: { customerId: string }) {
  const { dict } = useI18n()
  const cd = dict.customerDetail
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
      const catLabel = (cd.delivery.photoCategories as Record<string, string>)[category] ?? category
      if (url) existing.push({ category, url, label: catLabel })
      return { ...f, photoUrls: existing }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...form,
      unloadingFloor:    form.unloadingFloor ? Number(form.unloadingFloor) : null,
      hasElevator:       form.hasElevator === 'true' ? true : form.hasElevator === 'false' ? false : null,
      needsCart:         form.needsCart   === 'true' ? true : form.needsCart   === 'false' ? false : null,
      hasReception:      form.hasReception === 'true' ? true : form.hasReception === 'false' ? false : null,
      elevatorMaxWeight: form.elevatorMaxWeight ? Number(form.elevatorMaxWeight) : null,
    }
    const res = await fetch(`/api/customers/${customerId}/delivery-profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) toast.success(dict.common.saveSuccess)
    else toast.error(dict.common.saveFailed)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const yesNoOpts = [{ value: '', label: cd.delivery.yesNoUnknown }, { value: 'true', label: cd.delivery.yesNoYes }, { value: 'false', label: cd.delivery.yesNoNo }]
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>
  )

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── 收貨地址 ── */}
      <div>
        <SectionTitle>{cd.delivery.sectionReceiving}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{cd.delivery.deliveryAddress}</Label>
            <Input value={form.deliveryAddress} onChange={e => setField('deliveryAddress', e.target.value)} placeholder={cd.delivery.deliveryAddressPlaceholder} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{cd.delivery.unloadingLocation}</Label>
            <Input value={form.unloadingLocation} onChange={e => setField('unloadingLocation', e.target.value)} placeholder={cd.delivery.unloadingLocationPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.unloadingFloor}</Label>
            <Input type="number" value={form.unloadingFloor} onChange={e => setField('unloadingFloor', e.target.value)} placeholder={cd.delivery.unloadingFloorPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.receiverName}</Label>
            <Input value={form.receiverName} onChange={e => setField('receiverName', e.target.value)} placeholder={cd.delivery.receiverNamePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.receiverPhone}</Label>
            <Input value={form.receiverPhone} onChange={e => setField('receiverPhone', e.target.value)} placeholder={cd.delivery.receiverPhonePlaceholder} />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 現場條件 ── */}
      <div>
        <SectionTitle>{cd.delivery.sectionSite}</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.delivery.hasElevator}</Label>
            <select className={sel} value={form.hasElevator} onChange={e => setField('hasElevator', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.needsCart}</Label>
            <select className={sel} value={form.needsCart} onChange={e => setField('needsCart', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.hasReception}</Label>
            <select className={sel} value={form.hasReception} onChange={e => setField('hasReception', e.target.value)}>
              {yesNoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 時段與動線 ── */}
      <div>
        <SectionTitle>{cd.delivery.sectionTiming}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.delivery.receivingHours}</Label>
            <Input value={form.receivingHours} onChange={e => setField('receivingHours', e.target.value)} placeholder={cd.delivery.receivingHoursPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.suggestedDeliveryTime}</Label>
            <Input value={form.suggestedDeliveryTime} onChange={e => setField('suggestedDeliveryTime', e.target.value)} placeholder={cd.delivery.suggestedDeliveryTimePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.parkingNotes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.parkingNotes} onChange={e => setField('parkingNotes', e.target.value)} placeholder={cd.delivery.parkingNotesPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.parkingSpot}</Label>
            <Input value={form.parkingSpot} onChange={e => setField('parkingSpot', e.target.value)} placeholder={cd.delivery.parkingSpotPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.parkingFee}</Label>
            <Input value={form.parkingFee} onChange={e => setField('parkingFee', e.target.value)} placeholder={cd.delivery.parkingFeePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.elevatorDimensions}</Label>
            <Input value={form.elevatorDimensions} onChange={e => setField('elevatorDimensions', e.target.value)} placeholder={cd.delivery.elevatorDimensionsPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.elevatorMaxWeight}</Label>
            <Input type="number" value={form.elevatorMaxWeight} onChange={e => setField('elevatorMaxWeight', e.target.value)} placeholder={cd.delivery.elevatorMaxWeightPlaceholder} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{cd.delivery.elevatorNotes}</Label>
            <Input value={form.elevatorNotes} onChange={e => setField('elevatorNotes', e.target.value)} placeholder={cd.delivery.elevatorNotesPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.delivery.routeNotes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.routeNotes} onChange={e => setField('routeNotes', e.target.value)} placeholder={cd.delivery.routeNotesPlaceholder} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-amber-700 font-semibold">{cd.delivery.driverNotesLabel}</Label>
            <textarea className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm resize-none" rows={3} value={form.driverNotes} onChange={e => setField('driverNotes', e.target.value)} placeholder={cd.delivery.driverNotesPlaceholder} />
            <p className="text-xs text-amber-600">{cd.delivery.driverNotesHint}</p>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{cd.delivery.deliveryNotes}</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} value={form.deliveryNotes} onChange={e => setField('deliveryNotes', e.target.value)} placeholder={cd.delivery.deliveryNotesPlaceholder} />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 配送照片 ── */}
      <div>
        <SectionTitle>{cd.delivery.sectionPhotos}</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">{cd.delivery.photosHint}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(cd.delivery.photoCategories) as Array<keyof typeof cd.delivery.photoCategories>).map(category => {
            const label = cd.delivery.photoCategories[category]
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
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.delivery.saveBtn}
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// DemandForecastTab component
// ═══════════════════════════════════════════════════════════

const TREND_CLS: Record<string, string> = {
  GROWING:   'text-green-600 bg-green-50',
  DECLINING: 'text-red-600 bg-red-50',
  STABLE:    'text-blue-600 bg-blue-50',
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
  const { dict } = useI18n()
  const cu = dict.customers
  const cd = dict.customerDetail
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
      toast.info(dict.customers.noOrdersToAnalyze)
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
    toast.success(cu.syncedFromProfile)
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
    if (res.ok) toast.success(dict.common.saveSuccess)
    else toast.error(dict.common.saveFailed)
  }

  useEffect(() => { load() }, [customerId])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sel = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>
  )

  const displayAnalytics = analytics ?? (storedForecast?.avgDaysBetweenOrders != null ? storedForecast : null)
  const trendKey = displayAnalytics?.last3OrdersTrend
  const trendLabel = trendKey ? (cd.forecast.trendLabels as Record<string, string>)[trendKey] ?? trendKey : null
  const trendCls = trendKey ? TREND_CLS[trendKey] ?? '' : ''

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── 歷史訂單分析 ── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>{cd.forecast.sectionAnalytics}</SectionTitle>
          <Button type="button" variant="outline" size="sm" onClick={runAnalytics} disabled={analyzing}>
            {analyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            {cd.forecast.reanalyzeBtn}
          </Button>
        </div>
        {displayAnalytics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: cd.forecast.orderCount, value: `${'orderCount' in displayAnalytics ? displayAnalytics.orderCount : '—'}${cd.forecast.orderCountUnit}` },
              { label: cd.forecast.avgInterval, value: displayAnalytics.avgDaysBetweenOrders != null ? `${displayAnalytics.avgDaysBetweenOrders}${cd.forecast.avgIntervalUnit}` : '—' },
              { label: cd.forecast.avgCases, value: displayAnalytics.avgCasesPerOrder != null ? `${displayAnalytics.avgCasesPerOrder}${cd.forecast.avgCasesUnit}` : '—' },
              { label: cd.forecast.trendLabel, value: trendLabel ? undefined : '—', custom: trendLabel ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${trendCls}`}>{trendLabel}</span>
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
            <p className="text-sm">{cd.forecast.noAnalytics}</p>
          </div>
        )}
        {displayAnalytics?.predictedNextOrderDate && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              {cd.forecast.predictedNextOrder}<span className="font-semibold">{fmtDate(displayAnalytics.predictedNextOrderDate)}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── 每日/月用量預估 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>{cd.forecast.sectionUsage}</SectionTitle>
          <Button type="button" variant="outline" size="sm" onClick={syncFromUsage} disabled={saving}>
            {cd.forecast.syncFromUsage}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { dailyKey: 'dailyDiaperLargeQty' as keyof ForecastFormData, monthlyKey: 'monthlyDiaperLargeQty' as keyof ForecastFormData, label: cd.forecast.productDiaperLarge },
            { dailyKey: 'dailyDiaperSmallQty' as keyof ForecastFormData, monthlyKey: 'monthlyDiaperSmallQty' as keyof ForecastFormData, label: cd.forecast.productDiaperSmall },
            { dailyKey: 'dailyUnderpadsQty'   as keyof ForecastFormData, monthlyKey: 'monthlyUnderpadsQty'   as keyof ForecastFormData, label: cd.forecast.productUnderpads },
            { dailyKey: 'dailyWipesQty'       as keyof ForecastFormData, monthlyKey: 'monthlyWipesQty'       as keyof ForecastFormData, label: cd.forecast.productWipes },
          ].map(({ dailyKey, monthlyKey, label }) => (
            <div key={dailyKey} className="rounded-lg border bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">{label}</p>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{cd.forecast.dailyUnit}</Label>
                <Input type="number" min={0} value={form[dailyKey] as string}
                  onChange={e => setField(dailyKey, e.target.value)} className="h-8 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{cd.forecast.monthlyUnit}</Label>
                <Input type="number" min={0} value={form[monthlyKey] as string}
                  onChange={e => setField(monthlyKey, e.target.value)}
                  className={`h-8 text-sm ${form[monthlyKey] ? 'border-blue-300 bg-blue-50' : ''}`} placeholder={cd.forecast.monthlyAuto} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── 下單節奏（手動）── */}
      <div>
        <SectionTitle>{cd.forecast.sectionRhythm}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{cd.forecast.orderFrequency}</Label>
            <select className={sel} value={form.orderFrequency} onChange={e => setField('orderFrequency', e.target.value)}>
              <option value="">{cd.forecast.selectPlaceholder}</option>
              {(Object.keys(cd.forecast.orderFreqLabels) as Array<keyof typeof cd.forecast.orderFreqLabels>).map(v => <option key={v} value={v}>{cd.forecast.orderFreqLabels[v]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{cd.forecast.avgOrderQty}</Label>
            <Input type="number" min={0} value={form.avgOrderQty} onChange={e => setField('avgOrderQty', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.forecast.nextExpectedDate}</Label>
            <Input type="date" value={form.nextExpectedOrderDate} onChange={e => setField('nextExpectedOrderDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{cd.forecast.forecastConfidence}</Label>
            <select className={sel} value={form.forecastConfidence} onChange={e => setField('forecastConfidence', e.target.value)}>
              <option value="">{cd.forecast.selectPlaceholder}</option>
              {(Object.keys(cd.forecast.confidenceLabels) as Array<keyof typeof cd.forecast.confidenceLabels>).map(v => <option key={v} value={v}>{cd.forecast.confidenceLabels[v]}</option>)}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{cd.forecast.notesLabel}</Label>
            <Input value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder={cd.forecast.notesPlaceholder} />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.forecast.saveBtn}
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════
// ComplaintsTab component
// ═══════════════════════════════════════════════════════════

const SEVERITY_CLS: Record<string, string> = {
  LOW:      'bg-slate-50 text-slate-500 border-slate-200',
  MEDIUM:   'bg-amber-50 text-amber-600 border-amber-200',
  HIGH:     'bg-orange-50 text-orange-600 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
}
const METHOD_OPTIONS = ['PHONE_CALL','ONSITE_VISIT','EMAIL','LINE','VIDEO_CALL','OTHER']

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
  const { dict } = useI18n()
  const cu = dict.customers
  const cd = dict.customerDetail
  const complaintStatusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    OPEN:        { label: (cd.complaints.statusLabels as Record<string,string>).OPEN,        cls: complaintStatusClsMap.OPEN,        icon: complaintStatusIconMap.OPEN },
    IN_PROGRESS: { label: (cd.complaints.statusLabels as Record<string,string>).IN_PROGRESS, cls: complaintStatusClsMap.IN_PROGRESS, icon: complaintStatusIconMap.IN_PROGRESS },
    RESOLVED:    { label: (cd.complaints.statusLabels as Record<string,string>).RESOLVED,    cls: complaintStatusClsMap.RESOLVED,    icon: complaintStatusIconMap.RESOLVED },
    CLOSED:      { label: (cd.complaints.statusLabels as Record<string,string>).CLOSED,      cls: complaintStatusClsMap.CLOSED,      icon: complaintStatusIconMap.CLOSED },
  }
  const complaintTypeLabel = cd.complaints.typeLabels as Record<string, string>
  const ACTION_LABEL = cd.complaints.actionLabels as Record<string, string>
  const METHOD_LABEL = cd.complaints.methodLabels as Record<string, string>
  const severityLabels = cd.complaints.severityLabels as Record<string, string>
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
    if (res.ok) { toast.success(cu.afterSaleCreated); setNewOpen(false); setNewForm(emptyNew()); setNewFiles([]); loadRecords() }
    else toast.error(dict.common.createFailed)
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
      toast.success(cu.resolutionCreated); setLogTarget(null); setLogForm(emptyLog()); setLogFiles([])
      loadRecords(); loadLogs(logTarget)
    } else toast.error(dict.common.createFailed)
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
    if (res.ok) { toast.success(dict.common.updateSuccess); setUpdateTarget(null); loadRecords() }
    else toast.error(dict.common.updateFailed)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/customers/${customerId}/complaints?recordId=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(dict.common.deleteSuccess); loadRecords() }
    else toast.error(dict.common.deleteFailed)
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
              <AlertCircle className="mr-1 h-3 w-3" />{cd.complaints.pendingBadge.replace('{n}', String(openCount))}
            </Badge>
          )}
          {records.filter(r => r.severity === 'CRITICAL').length > 0 && (
            <Badge className="bg-red-600 text-white">
              {cd.complaints.criticalBadge.replace('{n}', String(records.filter(r => r.severity === 'CRITICAL').length))}
            </Badge>
          )}
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />{cd.complaints.addBtn}
        </Button>
      </div>

      {records.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">{cd.complaints.noRecords}</p>
      )}

      {records.map(c => {
        const sc  = complaintStatusConfig[c.status]  ?? complaintStatusConfig.OPEN
        const sevCls = SEVERITY_CLS[c.severity] ?? SEVERITY_CLS.MEDIUM
        const sevLabel = severityLabels[c.severity] ?? c.severity
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
                <Badge variant="outline" className={`text-xs ${sevCls}`}>{sevLabel}{cd.complaints.severityLabel}</Badge>
                {noFirstResponse && (
                  <Badge className="text-xs bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle className="mr-1 h-3 w-3" />{cd.complaints.noFirstResponse}
                  </Badge>
                )}
                {overdue && (
                  <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-200">
                    <Clock className="mr-1 h-3 w-3" />{cd.complaints.overdueLabel}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => toggleExpand(c.id)}
                  className="rounded px-2 py-1 text-xs hover:bg-slate-100 text-slate-500">
                  {isExpanded ? cd.complaints.collapseBtn : cd.complaints.logsCountBtn.replace('{n}', String(c._count.logs))}
                </button>
                <button onClick={() => { setLogTarget(c.id); setLogForm(emptyLog()) }}
                  className="rounded px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium">
                  {cd.complaints.addLogBtn}
                </button>
                {(c.status === 'OPEN' || c.status === 'IN_PROGRESS') && (
                  <button onClick={() => { setUpdateTarget(c); setUpdateForm({ status: 'RESOLVED', resolution: c.resolution ?? '', handler: c.handler ?? '' }) }}
                    className="rounded px-2 py-1 hover:bg-green-50 text-green-600 text-xs font-medium">
                    {cd.complaints.updateStatusBtn}
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
              <span>{cd.complaints.reportedBy}{c.reportedBy.name}</span>
              {c.handler && <span>{cd.complaints.handler}{c.handler}</span>}
              {c.assignedSupervisor && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{cd.complaints.supervisor}{c.assignedSupervisor.name}
                  {c.supervisorAppointDate && ` (${fmtDate(c.supervisorAppointDate)})`}
                </span>
              )}
              {c.firstResponseAt ? (
                <span className="text-green-600">
                  {cd.complaints.firstResponse}{fmtDateTime(c.firstResponseAt)}
                  {c.firstResponseMethod && ` · ${METHOD_LABEL[c.firstResponseMethod] ?? c.firstResponseMethod}`}
                </span>
              ) : (
                <span className="text-red-500">{cd.complaints.noFirstResponseYet}</span>
              )}
              {c.nextFollowUpDate && (
                <span className={overdue ? 'text-orange-600 font-medium' : ''}>
                  {cd.complaints.nextFollowUp}{fmtDate(c.nextFollowUpDate)}
                  {c.nextFollowUpMethod && ` · ${METHOD_LABEL[c.nextFollowUpMethod] ?? c.nextFollowUpMethod}`}
                </span>
              )}
              {c.resolvedAt && <span>{cd.complaints.resolvedAt}{fmtDate(c.resolvedAt)}</span>}
              {c.closedAt   && <span>{cd.complaints.closedAt}{fmtDate(c.closedAt)}</span>}
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
                <span className="font-medium">{cd.complaints.resolutionLabel}</span>{c.resolution}
              </p>
            )}

            {/* Expanded log timeline */}
            {isExpanded && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{cd.complaints.logTimelineTitle}</p>
                {logsLoading === c.id ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : (logs[c.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{cd.complaints.noLogs}</p>
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
                              {cd.complaints.logNextLabel}{fmtDate(log.nextFollowUpDate)}
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
          <DialogHeader><DialogTitle>{cd.complaints.newDialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{cd.complaints.dateLabel}</Label>
                <Input type="date" value={newForm.complaintDate}
                  onChange={e => setNewForm(p => ({ ...p, complaintDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.complaints.typeLabel}</Label>
                <select className={cSel} value={newForm.type}
                  onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))}>
                  {complaintTypes.map(t => <option key={t} value={t}>{complaintTypeLabel[t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.severityFormLabel}</Label>
              <div className="flex gap-2">
                {(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => setNewForm(p => ({ ...p, severity: s }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${newForm.severity === s ? SEVERITY_CLS[s] + ' border-current' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    {severityLabels[s] ?? s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.contentLabel}</Label>
              <textarea className={cTa} rows={4} value={newForm.content}
                onChange={e => setNewForm(p => ({ ...p, content: e.target.value }))}
                placeholder={cd.complaints.contentPlaceholder} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{cd.complaints.handlerLabel}</Label>
                <Input value={newForm.handler}
                  onChange={e => setNewForm(p => ({ ...p, handler: e.target.value }))}
                  placeholder={cd.complaints.handlerPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <Label>{cd.complaints.supervisorLabel}</Label>
                <select className={cSel} value={newForm.assignedSupervisorId}
                  onChange={e => setNewForm(p => ({ ...p, assignedSupervisorId: e.target.value }))}>
                  <option value="">{cd.complaints.supervisorEmpty}</option>
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {newForm.assignedSupervisorId && (
              <div className="space-y-1.5">
                <Label>{cd.complaints.appointDateLabel}</Label>
                <Input type="datetime-local" value={newForm.supervisorAppointDate}
                  onChange={e => setNewForm(p => ({ ...p, supervisorAppointDate: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{cd.complaints.uploadLabel}</Label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400 transition-colors">
                <ImagePlus className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-muted-foreground">{cd.complaints.uploadHint}</span>
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
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-60 hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewOpen(false); setNewFiles([]) }} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.complaints.addRecordBtn}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 新增處理紀錄 Dialog ── */}
      <Dialog open={!!logTarget} onOpenChange={o => { if (!o) { setLogTarget(null); setLogFiles([]) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{cd.complaints.logDialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddLog} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{cd.complaints.actionLabel}</Label>
                <select className={cSel} value={logForm.action}
                  onChange={e => setLogForm(p => ({ ...p, action: e.target.value }))}>
                  {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{cd.complaints.methodLabel}</Label>
                <select className={cSel} value={logForm.nextFollowUpMethod}
                  onChange={e => setLogForm(p => ({ ...p, nextFollowUpMethod: e.target.value }))}>
                  <option value="">{cd.complaints.methodEmpty}</option>
                  {METHOD_OPTIONS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.descLabel}</Label>
              <textarea className={cTa} rows={4} value={logForm.description}
                onChange={e => setLogForm(p => ({ ...p, description: e.target.value }))}
                placeholder={cd.complaints.descPlaceholder} required />
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.nextDateLabel}</Label>
              <Input type="date" value={logForm.nextFollowUpDate}
                onChange={e => setLogForm(p => ({ ...p, nextFollowUpDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.uploadLabel}</Label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-dashed border-slate-300 px-4 py-3 hover:border-slate-400 transition-colors">
                <ImagePlus className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-muted-foreground">{cd.complaints.uploadHint}</span>
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
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-60 hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setLogTarget(null); setLogFiles([]) }} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.complaints.addRecordBtn}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 更新狀態 Dialog ── */}
      <Dialog open={!!updateTarget} onOpenChange={o => !o && setUpdateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{cd.complaints.updateDialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{cd.complaints.statusLabel}</Label>
              <select className={cSel} value={updateForm.status}
                onChange={e => setUpdateForm(p => ({ ...p, status: e.target.value }))}>
                {(['OPEN','IN_PROGRESS','RESOLVED','CLOSED'] as const).map(s => (
                  <option key={s} value={s}>{complaintStatusConfig[s]?.label ?? s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.handlerFormLabel}</Label>
              <Input value={updateForm.handler}
                onChange={e => setUpdateForm(p => ({ ...p, handler: e.target.value }))}
                placeholder={cd.complaints.handlerPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{cd.complaints.resolutionFormLabel}</Label>
              <textarea className={cTa} rows={3} value={updateForm.resolution}
                onChange={e => setUpdateForm(p => ({ ...p, resolution: e.target.value }))}
                placeholder={cd.complaints.resolutionPlaceholder} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpdateTarget(null)} disabled={saving}>{dict.common.cancel}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{cd.complaints.updateBtn}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

