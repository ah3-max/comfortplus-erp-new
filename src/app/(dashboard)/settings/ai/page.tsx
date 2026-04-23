'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bot, CheckCircle2, XCircle, Loader2, RefreshCw, Server, Cpu, Eye, Save,
  Plus, Trash2, GripVertical, Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'

interface HealthData {
  config: {
    provider: string
    ollamaUrl: string
    ollamaModel: string
    anthropicModel: string
  }
  ollama: {
    ok: boolean
    models?: string[]
    error?: string
  }
}

interface VisionProvider {
  name: string
  baseUrl: string
  model: string
  apiKey: string
  supportsImage: boolean
  enabled: boolean
}

function emptyProvider(): VisionProvider {
  return { name: '', baseUrl: '', model: '', apiKey: '', supportsImage: false, enabled: true }
}

export default function AiSettingsPage() {
  const { dict } = useI18n()
  const p = dict.settingsAi
  const { data: session } = useSession()
  const role = (session?.user?.role as string) ?? ''
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)

  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [provider, setProvider] = useState('')

  const [visionProviders, setVisionProviders] = useState<VisionProvider[]>([])
  const [visionSaving, setVisionSaving] = useState(false)

  async function fetchHealth() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/health')
      if (res.ok) {
        const data = await res.json()
        setHealth(data)
        setOllamaUrl(data.config.ollamaUrl)
        setOllamaModel(data.config.ollamaModel)
        setProvider(data.config.provider)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function fetchVisionConfig() {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const configs: Array<{ key: string; value: string }> = await res.json()
      const row = configs.find(c => c.key === 'ai_vision_providers')
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value) as VisionProvider[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVisionProviders(parsed)
            return
          }
        } catch { /* ignore */ }
      }
      // Migrate from old single-config format
      const map = Object.fromEntries(configs.map(c => [c.key, c.value]))
      if (map.ai_vision_base_url && map.ai_vision_model) {
        setVisionProviders([{
          name: '主要',
          baseUrl: map.ai_vision_base_url,
          model: map.ai_vision_model,
          apiKey: map.ai_vision_api_key ?? '',
          supportsImage: true,
          enabled: true,
        }])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchHealth(); fetchVisionConfig() }, [])

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '你好，請回覆「連線成功」' }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`AI 連線成功！(${data.provider} / ${data.model})`)
      } else {
        const err = await res.json()
        toast.error(`連線失敗：${err.error}`)
      }
    } catch (e) {
      toast.error(`連線失敗：${(e as Error).message}`)
    } finally { setTesting(false) }
  }

  function updateProvider(idx: number, patch: Partial<VisionProvider>) {
    setVisionProviders(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function removeProvider(idx: number) {
    setVisionProviders(prev => prev.filter((_, i) => i !== idx))
  }

  function moveProvider(idx: number, dir: -1 | 1) {
    setVisionProviders(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function saveVisionProviders() {
    setVisionSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_vision_providers: JSON.stringify(visionProviders),
        }),
      })
      if (res.ok) {
        toast.success(p.visionSaveSuccess)
      } else {
        const err = await res.json()
        toast.error(err.error ?? '儲存失敗')
      }
    } catch {
      toast.error('儲存失敗')
    } finally { setVisionSaving(false) }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {p.adminOnly}
      </div>
    )
  }

  const enabledCount = visionProviders.filter(p => p.enabled && p.baseUrl && p.model).length

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.settings.title} — AI</h1>
        <p className="text-sm text-muted-foreground">{p.subtitle}</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              {p.statusCard}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading} title={dict.common.refresh}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {dict.common.loading}
            </div>
          ) : health ? (
            <>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">{p.currentProvider}</span>
                <Badge variant="outline" className="text-sm">
                  {health.config.provider === 'anthropic' ? p.providerAnthropicLabel : p.providerOllamaLabel}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">{p.currentModel}</span>
                <span className="text-sm font-mono">
                  {health.config.provider === 'anthropic'
                    ? health.config.anthropicModel
                    : health.config.ollamaModel}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">{p.ollamaServer}</span>
                <div className="flex items-center gap-2">
                  {health.ollama.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-mono">{health.config.ollamaUrl}</span>
                </div>
              </div>
              {health.ollama.ok && health.ollama.models && (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground mb-2">{p.availableModels}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {health.ollama.models.map(m => (
                      <Badge key={m} variant="secondary" className="text-xs font-mono">
                        <Cpu className="h-3 w-3 mr-1" />{m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {!health.ollama.ok && health.ollama.error && (
                <p className="text-sm text-red-600">
                  {p.ollamaError}{health.ollama.error}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.common.loadFailed}</p>
          )}
        </CardContent>
      </Card>

      {/* Chat Config Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            {p.configCard}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{p.providerLabel}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
              {[
                { value: 'anthropic', label: p.providerAnthropicLabel, sub: p.providerAnthropicSub },
                { value: 'ollama', label: 'Ollama', sub: p.providerOllamaSub },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setProvider(opt.value)}
                  className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
                    provider === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200'
                  }`}>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {provider === 'ollama' && (
            <>
              <div className="space-y-1.5">
                <Label>{p.ollamaUrlLabel}</Label>
                <Input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
                  placeholder={p.ollamaUrlPlaceholder} />
                <p className="text-xs text-muted-foreground">{p.ollamaUrlHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{p.modelLabel}</Label>
                <Input value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                  placeholder={p.modelPlaceholder} />
                <p className="text-xs text-muted-foreground">{p.modelHint}</p>
              </div>
            </>
          )}

          {provider === 'anthropic' && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-700">{p.anthropicNote}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">{p.configNote}</p>
        </CardContent>
      </Card>

      {/* Vision Providers Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              {p.visionCard}
            </CardTitle>
            <Badge variant={enabledCount > 0 ? 'default' : 'secondary'} className="text-xs">
              {enabledCount > 0 ? `${enabledCount} 組${p.visionConfigured}` : p.visionNotConfigured}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{p.visionSubtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {visionProviders.map((vp, idx) => (
            <div key={idx} className={`rounded-lg border-2 p-4 space-y-3 transition-colors ${vp.enabled ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" className="text-muted-foreground hover:text-foreground p-0 leading-none text-xs"
                      onClick={() => moveProvider(idx, -1)} disabled={idx === 0}>▲</button>
                    <button type="button" className="text-muted-foreground hover:text-foreground p-0 leading-none text-xs"
                      onClick={() => moveProvider(idx, 1)} disabled={idx === visionProviders.length - 1}>▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="text-xs shrink-0">
                    {idx === 0 ? '主要' : `備用 ${idx}`}
                  </Badge>
                  <Input value={vp.name} onChange={e => updateProvider(idx, { name: e.target.value })}
                    placeholder="名稱（如：本地 vLLM）" className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => updateProvider(idx, { enabled: !vp.enabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${vp.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${vp.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => removeProvider(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{p.visionBaseUrl}</Label>
                  <Input value={vp.baseUrl} onChange={e => updateProvider(idx, { baseUrl: e.target.value })}
                    placeholder={p.visionBaseUrlPlaceholder} className="h-8 text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{p.visionModel}</Label>
                  <Input value={vp.model} onChange={e => updateProvider(idx, { model: e.target.value })}
                    placeholder={p.visionModelPlaceholder} className="h-8 text-sm font-mono" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{p.visionApiKey}</Label>
                  <Input type="password" value={vp.apiKey} onChange={e => updateProvider(idx, { apiKey: e.target.value })}
                    placeholder={p.visionApiKeyPlaceholder} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <button type="button" onClick={() => updateProvider(idx, { supportsImage: !vp.supportsImage })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${vp.supportsImage ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${vp.supportsImage ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <Label className="text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <ImageIcon className="h-3.5 w-3.5" />
                    支援圖片
                  </Label>
                </div>
              </div>

              {!vp.supportsImage && (
                <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  僅用於 PDF 文字辨識。圖片收據需要支援圖片的模型。
                </p>
              )}
            </div>
          ))}

          <Button variant="outline" className="w-full border-dashed"
            onClick={() => setVisionProviders(prev => [...prev, emptyProvider()])}>
            <Plus className="h-4 w-4 mr-1" />新增 API
          </Button>

          <div className="rounded-lg bg-slate-50 border p-3 text-xs text-muted-foreground space-y-1">
            <p>排序越前面優先使用，失敗時自動切換到下一組。</p>
            <p>「支援圖片」開啟 → 可辨識拍照收據；關閉 → 僅限 PDF 文字收據（任何文字模型皆可）。</p>
          </div>

          {visionProviders.length > 0 && (
            <Button onClick={saveVisionProviders} disabled={visionSaving} className="w-full">
              {visionSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />{p.visionSaving}</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />{p.visionSaveBtn}</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Button onClick={testConnection} disabled={testing} className="w-full">
        {testing ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />{p.testingButton}</>
        ) : (
          <><Bot className="h-4 w-4 mr-2" />{p.testButton}</>
        )}
      </Button>
    </div>
  )
}
