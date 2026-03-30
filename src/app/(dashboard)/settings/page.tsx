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

// Static arrays/maps requiring dict are moved inside the component below

// ───────────────────────── component ──────────────────────
export default function SettingsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'GM'
  const sExt = dict.settingsExt
  const orgRoles = dict.orgChart.roles

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN:      orgRoles.SUPER_ADMIN,
    GM:               orgRoles.GM,
    SALES_MANAGER:    orgRoles.SALES_MANAGER,
    SALES:            orgRoles.SALES,
    CARE_SUPERVISOR:  orgRoles.CARE_SUPERVISOR,
    ECOMMERCE:        orgRoles.ECOMMERCE,
    CS:               orgRoles.CS,
    WAREHOUSE_MANAGER: orgRoles.WAREHOUSE_MANAGER,
    WAREHOUSE:        orgRoles.WAREHOUSE,
    PROCUREMENT:      orgRoles.PROCUREMENT,
    FINANCE:          orgRoles.FINANCE,
  }

  const FEATURE_FLAGS = [
    { key: 'feature_ecommerce',  label: sExt.featureEcommerce },
    { key: 'feature_care',       label: sExt.featureCare },
    { key: 'feature_budget',     label: sExt.featureBudget },
    { key: 'feature_approvals',  label: sExt.featureApprovals },
    { key: 'feature_contracts',  label: sExt.featureContracts },
    { key: 'feature_ai',         label: sExt.featureAI },
  ]

  const TEMPLATE_LIST = [
    { name: sExt.templateCustomers,  file: '/templates/customers.xlsx' },
    { name: sExt.templateProducts,   file: '/templates/products.xlsx' },
    { name: sExt.templateOrders,     file: '/templates/orders.xlsx' },
    { name: sExt.templateInventory,  file: '/templates/inventory.xlsx' },
    { name: sExt.templateSuppliers,  file: '/templates/suppliers.xlsx' },
  ]

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

  // ── notify test ──
  const [testingNotify, setTestingNotify] = useState<'line' | 'email' | null>(null)
  async function testNotify(channel: 'line' | 'email') {
    setTestingNotify(channel)
    try {
      const body: Record<string, string> = { channel }
      if (channel === 'email') body.email = configs['smtp_user'] ?? ''
      const res = await fetch('/api/settings/test-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) toast.success(data.message)
      else toast.error(data.error ?? '測試失敗')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTestingNotify(null)
    }
  }

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
        <p className="text-sm text-muted-foreground">{dict.settings.subtitle}</p>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {sExt.readOnlyMode}
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />{dict.settingsExt.company}</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5" onClick={loadUsers}><Users className="h-3.5 w-3.5" />{dict.users.title}</TabsTrigger>
          <TabsTrigger value="prefs" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />{dict.settingsExt.preferences}</TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />{sExt.otherMgmt}</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5" onClick={() => loadAudit(auditModule)}><Shield className="h-3.5 w-3.5" />{dict.settingsExt.security}</TabsTrigger>
          <TabsTrigger value="download" className="gap-1.5"><Download className="h-3.5 w-3.5" />{dict.common.download}</TabsTrigger>
        </TabsList>

        {/* ═══════════ 0.1 Company Info ═══════════ */}
        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.companyBasic}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'company_name',    label: sExt.companyName,    ph: 'ComfortPlus Co., Ltd.' },
                { key: 'company_tax_id',  label: sExt.taxId,          ph: '12345678' },
                { key: 'company_phone',   label: sExt.companyPhone,   ph: '02-1234-5678' },
                { key: 'company_address', label: sExt.companyAddress, ph: '...' },
                { key: 'company_email',   label: sExt.companyEmail,   ph: 'info@company.com' },
                { key: 'company_website', label: 'Website',           ph: 'https://www.company.com' },
                { key: 'company_logo_url', label: 'Logo URL',         ph: 'https://cdn.../logo.png' },
                { key: 'company_seal_url', label: 'Seal URL',         ph: 'https://cdn.../seal.png' },
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
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />{sExt.apiKey}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input value={configs['api_key_primary'] ?? ''} readOnly placeholder={sExt.apiKeyNotGenerated} className="font-mono text-xs" />
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={generateKey} className="shrink-0">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />{sExt.generate}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{sExt.apiKeyDesc}</p>
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

        {/* ═══════════ 0.2 Users ═══════════ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Tabs defaultValue="userlist">
            <TabsList>
              <TabsTrigger value="userlist">{sExt.userList}</TabsTrigger>
              <TabsTrigger value="permissions" onClick={loadPerms}>{sExt.rolePerms}</TabsTrigger>
            </TabsList>

            {/* User List */}
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
                        {[dict.users.name, 'Email', dict.users.role, dict.common.status, dict.common.actions].map(h => (
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

            {/* Role Permissions Matrix */}
            <TabsContent value="permissions" className="mt-4 space-y-3">
              {loadingPerm ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : permData ? (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium sticky left-0 bg-slate-50 border-r">{dict.common.module}</th>
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

        {/* ═══════════ 0.3 Preferences ═══════════ */}
        <TabsContent value="prefs" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.defaultValues}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'default_payment_terms',  label: sExt.defaultPaymentTerms, ph: 'NET30' },
                { key: 'quotation_valid_days',    label: sExt.quotationValidDays,  ph: '30' },
                { key: 'default_currency',        label: sExt.defaultCurrency,     ph: 'TWD' },
                { key: 'decimal_places',          label: sExt.decimalPlaces,       ph: '0' },
                { key: 'default_vat_rate',        label: sExt.defaultVatRate,      ph: '5' },
                { key: 'low_stock_threshold',     label: sExt.lowStockThreshold,   ph: '10' },
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
              <CardTitle className="text-base">{sExt.featureFlags}</CardTitle>
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

        {/* ═══════════ 0.4 Other Mgmt ═══════════ */}
        <TabsContent value="other" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{dict.settingsExt.notifications}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'line_notify_token',  label: 'LINE Notify Token',  ph: 'xxxxxx' },
                { key: 'smtp_host',          label: sExt.smtpHost,        ph: 'smtp.gmail.com' },
                { key: 'smtp_port',          label: sExt.smtpPort,        ph: '587' },
                { key: 'smtp_user',          label: sExt.smtpUser,        ph: 'noreply@company.com' },
                { key: 'smtp_password',      label: sExt.smtpPassword,    ph: '••••••••' },
                { key: 'notify_from_name',   label: sExt.notifyFromName,  ph: 'ComfortPlus ERP' },
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
              {isAdmin && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Button variant="outline" size="sm" disabled={testingNotify === 'line'}
                    onClick={() => testNotify('line')}>
                    {testingNotify === 'line' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                    {dict.settingsExt.testLine}
                  </Button>
                  <Button variant="outline" size="sm" disabled={testingNotify === 'email'}
                    onClick={() => testNotify('email')}>
                    {testingNotify === 'email' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                    {dict.settingsExt.testEmail}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.customerPortal}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'customer_portal_url',   label: 'Portal URL',    ph: 'https://portal.company.com' },
                { key: 'customer_portal_title',  label: 'Portal Title', ph: 'ComfortPlus Customer Portal' },
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

        {/* ═══════════ 0.5 Security ═══════════ */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.securitySettings}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'session_timeout_hours', label: sExt.sessionTimeoutH,    ph: '8' },
                { key: 'max_login_attempts',    label: sExt.maxLoginAttempts,   ph: '5' },
                { key: 'password_min_length',   label: sExt.passwordMinLength,  ph: '8' },
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
                <Label className="text-sm">{sExt.forceTwoFA}</Label>
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
                  <CardTitle className="text-base">{sExt.auditLog}</CardTitle>
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
                        <SelectItem value="all">{sExt.allModules}</SelectItem>
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
                            {[sExt.auditTime, sExt.auditUser, sExt.auditRole, sExt.auditModule, sExt.auditAction, sExt.auditTarget, sExt.auditIP].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{sExt.noAuditRecords}</td></tr>
                          ) : auditLogs.map(log => (
                            <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50/50">
                              <td className="px-3 py-1.5 whitespace-nowrap">{new Date(log.timestamp).toLocaleString(undefined, { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
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
                      {auditTotal} {dict.common.records}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════ 0.6 Download ═══════════ */}
        <TabsContent value="download" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.excelTemplates}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-2">
              {TEMPLATE_LIST.map(t => (
                <div key={t.file} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-sm font-medium">{t.name}</span>
                  <a href={t.file} download className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                    <Download className="h-3.5 w-3.5" />{dict.common.download}
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sExt.systemInfo}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{sExt.systemVersion}</span>
                <span className="font-medium">V1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{sExt.framework}</span>
                <span>Next.js 16 + Prisma 7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{sExt.database}</span>
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
              <Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder={dict.users.name} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">{editUser ? sExt.newPasswordHint : sExt.passwordLabel}</Label>
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
