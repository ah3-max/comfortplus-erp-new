'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bot, CheckCircle2, XCircle, Loader2, RefreshCw, Server, Cpu,
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

export default function AiSettingsPage() {
  const { dict } = useI18n()
  const { data: session } = useSession()
  const role = (session?.user?.role as string) ?? ''
  const isAdmin = ['SUPER_ADMIN', 'GM'].includes(role)

  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  // Form state (for future API-based config)
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [provider, setProvider] = useState('')

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

  useEffect(() => { fetchHealth() }, [])

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

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        僅管理員可存取此頁面
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.settings.title} — AI</h1>
        <p className="text-sm text-muted-foreground">管理 AI 助手的模型連線設定</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              連線狀態
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
                <span className="text-sm">目前提供者</span>
                <Badge variant="outline" className="text-sm">
                  {health.config.provider === 'anthropic' ? 'Anthropic Claude' : 'Ollama (本地)'}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">使用模型</span>
                <span className="text-sm font-mono">
                  {health.config.provider === 'anthropic'
                    ? health.config.anthropicModel
                    : health.config.ollamaModel}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Ollama 伺服器</span>
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
                  <p className="text-sm text-muted-foreground mb-2">可用模型：</p>
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
                  Ollama 錯誤：{health.ollama.error}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.common.loadFailed}</p>
          )}
        </CardContent>
      </Card>

      {/* Config Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            連線設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>AI 提供者</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
              {[
                { value: 'anthropic', label: 'Anthropic Claude', sub: '雲端 API' },
                { value: 'ollama', label: 'Ollama', sub: '本地 GPU' },
              ].map(p => (
                <button key={p.value} type="button"
                  onClick={() => setProvider(p.value)}
                  className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
                    provider === p.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200'
                  }`}>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {provider === 'ollama' && (
            <>
              <div className="space-y-1.5">
                <Label>Ollama 伺服器 URL</Label>
                <Input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://192.168.1.100:11434" />
                <p className="text-xs text-muted-foreground">
                  Dell 770 的 IP 位址 + port 11434
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>模型名稱</Label>
                <Input value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                  placeholder="llama3.1:70b" />
                <p className="text-xs text-muted-foreground">
                  建議：qwen2.5:72b（中文最佳）、llama3.1:70b（通用）
                </p>
              </div>
            </>
          )}

          {provider === 'anthropic' && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-700">
                目前使用 Anthropic Claude Sonnet。API Key 請設定在伺服器的 .env 檔案中。
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">
            注意：變更設定需要修改伺服器的 .env 檔案並重啟服務。
            此頁面目前僅供查看連線狀態。
          </p>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Button onClick={testConnection} disabled={testing} className="w-full">
        {testing ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 測試中...</>
        ) : (
          <><Bot className="h-4 w-4 mr-2" /> 測試 AI 連線</>
        )}
      </Button>

    </div>
  )
}
