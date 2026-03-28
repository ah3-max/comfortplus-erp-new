'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, Save, Building2, Users, SlidersHorizontal, Settings2,
  Shield, Download, Plus, Edit2, Key, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ───────────────────────── inline toggle ──────────────────
function ToggleSwitch({ checked, onCheckedChange, disabled }: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}
    >
      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

// ───────────────────────── types ──────────────────────────
interface Config { key: string; value: string; description: string | null }
interface UserRow { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string }
interface PermMatrix { matrix: Record<string, Record<string, boolean>>; roles: string[]; modules: string[] }
interface AuditRow {
  id: string; userName: string; userRole: string; module: string; action: string
  entityLabel: string | null; ipAddress: string | null; timestamp: string
}

const ALL_ROLES = [
  'SUPER_ADMIN','GM','SALES_MANAGER','SALES','CARE_SUPERVISOR',
  'ECOMMERCE','CS','WAREHOUSE_MANAGER','WAREHOUSE','PROCUREMENT','FINANCE',
]

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:'超級管理員', GM:'總經理', SALES_MANAGER:'業務主管',
  SALES:'業務', CARE_SUPERVISOR:'護理主管', ECOMMERCE:'電商',
  CS:'客服', WAREHOUSE_MANAGER:'倉管主管', WAREHOUSE:'倉庫',
  PROCUREMENT:'採購', FINANCE:'財務',
}

const FEATURE_FLAGS = [
  { key: 'feature_ecommerce',  label: '電商模組' },
  { key: 'feature_care',       label: '護理模組' },
  { key: 'feature_budget',     label: '預算管理' },
  { key: 'feature_approvals',  label: '電子簽核' },
  { key: 'feature_contracts',  label: '合約管理' },
  { key: 'feature_ai',         label: 'AI 助手' },
]

const TEMPLATE_LIST = [
  { name: '客戶匯入範本',   file: '/templates/customers.xlsx' },
  { name: '產品匯入範本',   file: '/templates/products.xlsx' },
  { name: '訂單匯入範本',   file: '/templates/orders.xlsx' },
  { name: '庫存匯入範本',   file: '/templates/inventory.xlsx' },
  { name: '供應商匯入範本', file: '/templates/suppliers.xlsx' },
]

// ───────────────────────── component ──────────────────────
export default function SettingsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'GM'

  // ── shared config ──
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)

  // ── users ──
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userDialog, setUserDialog] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'SALES' })
  const [savingUser, setSavingUser] = useState(false)

  // ── permissions ──
  const [permData, setPermData] = useState<PermMatrix | null>(null)
  const [loadingPerm, setLoadingPerm] = useState(false)
  const [savingPerm, setSavingPerm] = useState(false)

  // ── audit log ──
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditModule, setAuditModule] = useState('')

  // ───────── load config ─────────
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((list: Config[]) => {
        const m: Record<string, string> = {}
        list.forEach(c => { m[c.key] = c.value })
        setConfigs(m)
      })
      .finally(() => setLoadingCfg(false))
  }, [])

  function setCfg(key: string, value: string) {
    setConfigs(prev => ({ ...prev, [key]: value }))
  }

  async function saveConfigs(keys?: string[]) {
    setSavingCfg(true)
    const payload = keys
      ? Object.fromEntries(keys.map(k => [k, configs[k] ?? '']))
      : configs
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSavingCfg(false)
    if (res.ok) toast.success(dict.settingsExt.saveSuccess)
    else toast.error(dict.settingsExt.saveFailed)
  }

  // ───────── load users ─────────
  const loadUsers = useCallback(() => {
    if (!isAdmin) return
    setLoadingUsers(true)
    fetch('/api/users').then(r => r.json()).then(setUsers).finally(() => setLoadingUsers(false))
  }, [isAdmin])

  // ───────── load permissions ─────────
  const loadPerms = useCallback(() => {
    if (!isAdmin) return
    setLoadingPerm(true)
    fetch('/api/role-permissions').then(r => r.json()).then(setPermData).finally(() => setLoadingPerm(false))
  }, [isAdmin])

  // ───────── load audit log ─────────
  const loadAudit = useCallback((mod = '') => {
    if (!isAdmin) return
    setLoadingAudit(true)
    const url = `/api/settings/audit-log?pageSize=50${mod ? `&module=${mod}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setAuditLogs(d.data ?? []); setAuditTotal(d.pagination?.total ?? 0) })
      .finally(() => setLoadingAudit(false))
  }, [isAdmin])

  // ───────── permission toggle ─────────
  function togglePerm(role: string, mod: string) {
    if (!permData) return
    setPermData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        matrix: {
          ...prev.matrix,
          [role]: { ...prev.matrix[role], [mod]: !prev.matrix[role][mod] },
        },
      }
    })
  }

  async function savePerms() {
    if (!permData) return
    setSavingPerm(true)
    const res = await fetch('/api/role-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix: permData.matrix }),
    })
    setSavingPerm(false)
    if (res.ok) toast.success(dict.settingsExt.saveSuccess)
    else toast.error(dict.settingsExt.saveFailed)
  }

  // ───────── user save ─────────
  async function handleUserSave() {
    setSavingUser(true)
    let res: Response
    if (editUser) {
      res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userForm.name, role: userForm.role, isActive: editUser.isActive, ...(userForm.password ? { password: userForm.password } : {}) }),
      })
    } else {
      res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
    }
    setSavingUser(false)
    if (res.ok) {
      toast.success(editUser ? dict.common.updateSuccess : dict.common.createSuccess)
      setUserDialog(false)
      setEditUser(null)
      setUserForm({ email: '', name: '', password: '', role: 'SALES' })
      loadUsers()
    } else {
      const d = await res.json()
      toast.error(d.error ?? dict.common.error)
    }
  }

  async function toggleUserActive(u: UserRow) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: u.name, role: u.role, isActive: !u.isActive }),
    })
    if (res.ok) { toast.success(dict.common.updateSuccess); loadUsers() }
    else toast.error(dict.common.error)
  }

  // ───────── API key generate ─────────
  function generateKey() {
    const key = 'sk-' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    setCfg('api_key_primary', key)
  }

  if (loadingCfg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.settings.title}</h1>
        <p className="text-sm text-muted-foreground">管理公司資訊、用戶、功能與安全設定</p>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          目前為唯讀模式，僅管理員可修改設定。
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />{dict.settingsExt.company}</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5" onClick={loadUsers}><Users className="h-3.5 w-3.5" />{dict.users.title}</TabsTrigger>
          <TabsTrigger value="prefs" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />{dict.settingsExt.preferences}</TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />其他管理</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5" onClick={() => loadAudit(auditModule)}><Shield className="h-3.5 w-3.5" />{dict.settingsExt.security}</TabsTrigger>
          <TabsTrigger value="download" className="gap-1.5"><Download className="h-3.5 w-3.5" />{dict.common.download}</TabsTrigger>
        </TabsList>

        {/* ═══════════ 0.1 資訊管理 ═══════════ */}
        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">公司基本資料</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'company_name',    label: '公司名稱',   ph: '舒適加股份有限公司' },
                { key: 'company_tax_id',  label: '統一編號',   ph: '12345678' },
                { key: 'company_phone',   label: '聯絡電話',   ph: '02-1234-5678' },
                { key: 'company_address', label: '公司地址',   ph: '台北市信義區...' },
                { key: 'company_email',   label: '公司 Email', ph: 'info@company.com' },
                { key: 'company_website', label: '官方網站',   ph: 'https://www.company.com' },
                { key: 'company_logo_url', label: 'Logo URL', ph: 'https://cdn.../logo.png' },
                { key: 'company_seal_url', label: '印章圖片 URL', ph: 'https://cdn.../seal.png' },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                  <Label className="text-right text-sm">{f.label}</Label>
                  <div className="col-span-2">
                    <Input value={configs[f.key] ?? ''} onChange={e => setCfg(f.key, e.target.value)}
                      placeholder={f.ph} disabled={!isAdmin} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />API 金鑰</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input value={configs['api_key_primary'] ?? ''} readOnly placeholder="尚未產生" className="font-mono text-xs" />
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={generateKey} className="shrink-0">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />產生
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">此金鑰用於外部 API 呼叫，請妥善保管勿洩漏。</p>
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => saveConfigs()} disabled={savingCfg}>
                {savingCfg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {dict.common.save}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ 0.2 用戶管理 ═══════════ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Tabs defaultValue="userlist">
            <TabsList>
              <TabsTrigger value="userlist">用戶列表</TabsTrigger>
              <TabsTrigger value="permissions" onClick={loadPerms}>角色權限</TabsTrigger>
            </TabsList>

            {/* 用戶列表 */}
            <TabsContent value="userlist" className="mt-4 space-y-3">
              {isAdmin && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setEditUser(null); setUserForm({ email: '', name: '', password: '', role: 'SALES' }); setUserDialog(true) }}>
                    <Plus className="h-4 w-4 mr-1" />{dict.users.newUser}
                  </Button>
                </div>
              )}
              {loadingUsers ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50">
                      <tr>
                        {['名稱', 'Email', '角色', '狀態', '操作'].map(h => (
                          <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-medium">{u.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            {u.isActive
                              ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />{dict.common.active}</span>
                              : <span className="flex items-center gap-1 text-slate-400 text-xs"><XCircle className="h-3.5 w-3.5" />{dict.common.inactive}</span>}
                          </td>
                          <td className="px-4 py-2">
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                                  setEditUser(u)
                                  setUserForm({ email: u.email, name: u.name, password: '', role: u.role })
                                  setUserDialog(true)
                                }}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <ToggleSwitch checked={u.isActive} onCheckedChange={() => toggleUserActive(u)} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* 角色權限矩陣 */}
            <TabsContent value="permissions" className="mt-4 space-y-3">
              {loadingPerm ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : permData ? (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium sticky left-0 bg-slate-50 border-r">模組</th>
                          {permData.roles.map(r => (
                            <th key={r} className="px-2 py-2 text-center font-medium min-w-[64px]">
                              {ROLE_LABELS[r] ?? r}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permData.modules.map(mod => (
                          <tr key={mod} className="border-b last:border-0 hover:bg-slate-50/30">
                            <td className="px-3 py-1.5 font-mono text-slate-600 sticky left-0 bg-white border-r">{mod}</td>
                            {permData.roles.map(role => (
                              <td key={role} className="px-2 py-1.5 text-center">
                                <ToggleSwitch
                                  checked={permData.matrix[role]?.[mod] ?? false}
                                  onCheckedChange={() => isAdmin && togglePerm(role, mod)}
                                  disabled={!isAdmin}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-end">
                      <Button onClick={savePerms} disabled={savingPerm}>
                        {savingPerm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {dict.common.save}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══════════ 0.3 自主設定 ═══════════ */}
        <TabsContent value="prefs" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">預設值設定</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'default_payment_terms',  label: '預設付款條件', ph: 'NET30' },
                { key: 'quotation_valid_days',    label: '報價單有效天數', ph: '30' },
                { key: 'default_currency',        label: '預設幣別', ph: 'TWD' },
                { key: 'decimal_places',          label: '金額小數位數', ph: '0' },
                { key: 'default_vat_rate',        label: '預設稅率 (%)', ph: '5' },
                { key: 'low_stock_threshold',     label: '低庫存警戒量', ph: '10' },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                  <Label className="text-right text-sm">{f.label}</Label>
                  <div className="col-span-2">
                    <Input value={configs[f.key] ?? ''} onChange={e => setCfg(f.key, e.target.value)}
                      placeholder={f.ph} disabled={!isAdmin} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">功能開關</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {FEATURE_FLAGS.map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <Label className="text-sm">{f.label}</Label>
                  <ToggleSwitch
                    checked={configs[f.key] !== 'false'}
                    onCheckedChange={(v: boolean) => isAdmin && setCfg(f.key, v ? 'true' : 'false')}
                    disabled={!isAdmin}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => saveConfigs()} disabled={savingCfg}>
                {savingCfg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {dict.common.save}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ 0.4 其他管理 ═══════════ */}
        <TabsContent value="other" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">通知設定</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'line_notify_token',  label: 'LINE Notify Token', ph: 'xxxxxx' },
                { key: 'smtp_host',          label: 'SMTP 主機',         ph: 'smtp.gmail.com' },
                { key: 'smtp_port',          label: 'SMTP 埠',           ph: '587' },
                { key: 'smtp_user',          label: 'SMTP 帳號',         ph: 'noreply@company.com' },
                { key: 'smtp_password',      label: 'SMTP 密碼',         ph: '••••••••' },
                { key: 'notify_from_name',   label: '寄件人名稱',         ph: '舒適加 ERP' },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                  <Label className="text-right text-sm">{f.label}</Label>
                  <div className="col-span-2">
                    <Input
                      type={f.key.includes('password') || f.key.includes('token') ? 'password' : 'text'}
                      value={configs[f.key] ?? ''} onChange={e => setCfg(f.key, e.target.value)}
                      placeholder={f.ph} disabled={!isAdmin}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">客戶入口設定</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'customer_portal_url',   label: '客戶入口網址', ph: 'https://portal.company.com' },
                { key: 'customer_portal_title',  label: '入口標題',     ph: '舒適加客戶服務中心' },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                  <Label className="text-right text-sm">{f.label}</Label>
                  <div className="col-span-2">
                    <Input value={configs[f.key] ?? ''} onChange={e => setCfg(f.key, e.target.value)}
                      placeholder={f.ph} disabled={!isAdmin} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => saveConfigs()} disabled={savingCfg}>
                {savingCfg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {dict.common.save}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ 0.5 資安管理 ═══════════ */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">安全性設定</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'session_timeout_hours', label: 'Session 逾時 (小時)', ph: '8' },
                { key: 'max_login_attempts',    label: '最大登入失敗次數',     ph: '5' },
                { key: 'password_min_length',   label: '密碼最短長度',         ph: '8' },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                  <Label className="text-right text-sm">{f.label}</Label>
                  <div className="col-span-2">
                    <Input value={configs[f.key] ?? ''} onChange={e => setCfg(f.key, e.target.value)}
                      placeholder={f.ph} disabled={!isAdmin} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <Label className="text-sm">強制兩步驟驗證</Label>
                <ToggleSwitch
                  checked={configs['require_2fa'] === 'true'}
                  onCheckedChange={(v: boolean) => isAdmin && setCfg('require_2fa', v ? 'true' : 'false')}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => saveConfigs(['session_timeout_hours','max_login_attempts','password_min_length','require_2fa'])} disabled={savingCfg}>
                {savingCfg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {dict.common.save}
              </Button>
            </div>
          )}

          {/* Audit Log viewer */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">稽核日誌</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={auditModule || 'all'} onValueChange={(v: string | null) => {
                      const m = (v ?? '') === 'all' ? '' : (v ?? '')
                      setAuditModule(m)
                      loadAudit(m)
                    }}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部模組</SelectItem>
                        {['auth','orders','customers','inventory','users','settings'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => loadAudit(auditModule)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-0 p-0">
                {loadingAudit ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b bg-slate-50">
                          <tr>
                            {['時間','用戶','角色','模組','動作','對象','IP'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">暫無記錄</td></tr>
                          ) : auditLogs.map(log => (
                            <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50/50">
                              <td className="px-3 py-1.5 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                              <td className="px-3 py-1.5">{log.userName}</td>
                              <td className="px-3 py-1.5">{ROLE_LABELS[log.userRole] ?? log.userRole}</td>
                              <td className="px-3 py-1.5 font-mono">{log.module}</td>
                              <td className="px-3 py-1.5 font-mono">{log.action}</td>
                              <td className="px-3 py-1.5 max-w-[160px] truncate">{log.entityLabel ?? '-'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{log.ipAddress ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                      共 {auditTotal} 筆記錄，顯示最新 50 筆
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════ 0.6 下載 ═══════════ */}
        <TabsContent value="download" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Excel 匯入範本下載</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-2">
              {TEMPLATE_LIST.map(t => (
                <div key={t.file} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm font-medium">{t.name}</span>
                  <a href={t.file} download className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                    <Download className="h-3.5 w-3.5" />下載
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">系統資訊</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">系統版本</span>
                <span className="font-medium">V1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">框架</span>
                <span>Next.js 16 + Prisma 7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">資料庫</span>
                <span>PostgreSQL 16</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ User Dialog ═══ */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? dict.common.edit : dict.users.newUser}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editUser && (
              <div>
                <Label className="text-sm">Email</Label>
                <Input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" className="mt-1" />
              </div>
            )}
            <div>
              <Label className="text-sm">{dict.users.name}</Label>
              <Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="姓名" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">{editUser ? '新密碼（留空不修改）' : '密碼'}</Label>
              <Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">{dict.users.role}</Label>
              <Select value={userForm.role} onValueChange={(v: string | null) => setUserForm(f => ({ ...f, role: v ?? 'SALES' }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialog(false)}>{dict.common.cancel}</Button>
            <Button onClick={handleUserSave} disabled={savingUser}>
              {savingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editUser ? dict.common.save : dict.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
