/**
 * AI Provider Abstraction Layer
 *
 * Supports triple-provider architecture with automatic fallback:
 *   1. LM Studio (LAN) — M4 Pro 64GB, OpenAI-compatible API
 *   2. Ollama (local)   — Dell 770 server with 2x RTX PRO 6000 Black 96GB
 *   3. Anthropic Claude (cloud) — final fallback
 *
 * Fallback chain: LM Studio → Ollama → Anthropic
 *
 * Environment variables:
 *   AI_PROVIDER        — 'lmstudio' | 'ollama' | 'anthropic' (default: 'lmstudio')
 *   LMSTUDIO_URL       — e.g. http://192.168.0.157:1234/v1/chat/completions
 *   LMSTUDIO_MODEL     — e.g. google/gemma-4-31b
 *   OLLAMA_BASE_URL    — e.g. http://localhost:11434
 *   OLLAMA_MODEL       — e.g. llama3.1:70b
 *   ANTHROPIC_API_KEY  — required only if using Anthropic
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCompletionOptions {
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  /** Force a specific provider for this call */
  provider?: 'lmstudio' | 'ollama' | 'anthropic'
}

export interface AiVisionOptions {
  systemPrompt: string
  userText: string
  imageBase64?: string
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  temperature?: number
  maxTokens?: number
}

export interface AiCompletionResult {
  content: string
  provider: string
  model: string
  usage?: { promptTokens: number; completionTokens: number }
}

// ── Config ───────────────────────────────────────────────────────────────────

type AiProvider = 'lmstudio' | 'ollama' | 'anthropic'

function getConfig() {
  return {
    provider: (process.env.AI_PROVIDER ?? 'lmstudio') as AiProvider,
    lmstudio: {
      url: process.env.LMSTUDIO_URL ?? 'http://192.168.0.157:1234/v1/chat/completions',
      model: process.env.LMSTUDIO_MODEL ?? 'google/gemma-4-31b',
      timeoutMs: 180_000,
      // gemma-4 uses reasoning tokens heavily; need higher default to get full answers
      defaultMaxTokens: 4096,
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'llama3.1:70b',
    },
    anthropic: {
      model: 'claude-sonnet-4-6',
      maxTokens: 2048,
    },
  }
}

// ── LM Studio Provider (OpenAI-compatible) ──────────────────────────────────

async function lmstudioChat(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const config = getConfig()
  const { url, model, timeoutMs } = config.lmstudio

  const systemMsg = options.messages.find(m => m.role === 'system')
  const messages = options.messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? config.lmstudio.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LM Studio API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]?.message
  const content = choice?.content ?? ''
  const reasoning = choice?.reasoning_content

  return {
    content: content || (reasoning ? `[思考中] ${reasoning.slice(0, 500)}...` : ''),
    provider: 'lmstudio',
    model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens ?? 0,
      completionTokens: data.usage.completion_tokens ?? 0,
    } : undefined,
  }
}

async function lmstudioChatStream(options: AiCompletionOptions): Promise<ReadableStream> {
  const config = getConfig()
  const { url, model, timeoutMs } = config.lmstudio

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: options.messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens ?? config.lmstudio.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LM Studio stream error (${res.status}): ${text}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) { controller.close(); return }

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          continue
        }
        try {
          const json = JSON.parse(payload)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ content })}\n\n`
            ))
          }
        } catch { /* skip malformed lines */ }
      }
    },
  })
}

// ── Ollama Provider ──────────────────────────────────────────────────────────

async function ollamaChat(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const config = getConfig()
  const { baseUrl, model } = config.ollama

  const body = {
    model,
    messages: options.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama API error (${res.status}): ${text}`)
  }

  const data = await res.json()

  return {
    content: data.message?.content ?? '',
    provider: 'ollama',
    model,
    usage: data.prompt_eval_count != null ? {
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    } : undefined,
  }
}

async function ollamaChatStream(options: AiCompletionOptions): Promise<ReadableStream> {
  const config = getConfig()
  const { baseUrl, model } = config.ollama

  const body = {
    model,
    messages: options.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama API error (${res.status}): ${text}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) { controller.close(); return }

      const chunk = decoder.decode(value, { stream: true })
      // Ollama streams newline-delimited JSON
      const lines = chunk.split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          if (json.message?.content) {
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ content: json.message.content })}\n\n`
            ))
          }
          if (json.done) {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          }
        } catch { /* skip malformed lines */ }
      }
    },
  })
}

// ── Anthropic Provider ───────────────────────────────────────────────────────

async function anthropicChat(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const config = getConfig()
  // Dynamic import to avoid loading SDK when not needed
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()

  const systemMsg = options.messages.find(m => m.role === 'system')
  const chatMsgs = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: options.maxTokens ?? config.anthropic.maxTokens,
    ...(systemMsg && { system: systemMsg.content }),
    messages: chatMsgs,
  })

  const content = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  return {
    content,
    provider: 'anthropic',
    model: config.anthropic.model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    },
  }
}

// ── Vision (OpenAI-compatible API) ───────────────────────────────────────────

export interface VisionProvider {
  name: string
  baseUrl: string
  model: string
  apiKey: string
  supportsImage: boolean
  enabled: boolean
}

export async function getVisionProviders(): Promise<VisionProvider[]> {
  const { prisma } = await import('@/lib/prisma')
  const row = await prisma.systemConfig.findUnique({ where: { key: 'ai_vision_providers' } })
  if (!row?.value) return []
  try {
    const providers = JSON.parse(row.value) as VisionProvider[]
    return providers.filter(p => p.enabled && p.baseUrl && p.model)
  } catch { return [] }
}

async function callOpenaiCompatible(
  provider: VisionProvider,
  options: AiVisionOptions,
): Promise<AiCompletionResult> {
  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

  const hasImage = !!(options.imageBase64 && options.mimeType)

  let userContent: string | ContentPart[]
  if (hasImage && provider.supportsImage) {
    const parts: ContentPart[] = [
      { type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.imageBase64}` } },
      { type: 'text', text: options.userText },
    ]
    userContent = parts
  } else {
    userContent = options.userText
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[${provider.name}] API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    provider: provider.name,
    model: provider.model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens ?? 0,
      completionTokens: data.usage.completion_tokens ?? 0,
    } : undefined,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const FALLBACK_CHAIN: AiProvider[] = ['lmstudio', 'ollama', 'anthropic']

/**
 * Send a chat completion request to the configured AI provider.
 * If a specific provider is forced via options.provider, no fallback.
 * Otherwise follows fallback chain starting from the configured provider:
 *   lmstudio → ollama → anthropic
 */
export async function aiChat(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const configured = options.provider ?? getConfig().provider

  if (options.provider) {
    return callProvider(options.provider, options)
  }

  const startIdx = FALLBACK_CHAIN.indexOf(configured)
  const chain = startIdx >= 0
    ? FALLBACK_CHAIN.slice(startIdx)
    : FALLBACK_CHAIN

  const errors: string[] = []
  for (const provider of chain) {
    try {
      return await callProvider(provider, options)
    } catch (e) {
      const msg = (e as Error).message
      errors.push(`[${provider}] ${msg}`)
      // eslint-disable-next-line no-console
      console.warn(`AI fallback: ${provider} failed, trying next... (${msg})`)
    }
  }

  throw new Error(`所有 AI provider 均呼叫失敗：\n${errors.join('\n')}`)
}

async function callProvider(provider: AiProvider, options: AiCompletionOptions): Promise<AiCompletionResult> {
  switch (provider) {
    case 'lmstudio': return lmstudioChat(options)
    case 'ollama': return ollamaChat(options)
    case 'anthropic': return anthropicChat(options)
  }
}

/**
 * Send a prompt via OpenAI-compatible API with automatic fallback.
 * Providers are read from SystemConfig (admin settings).
 * For image input: only tries providers with supportsImage=true.
 * For text-only input: tries all providers.
 */
export async function aiVisionChat(options: AiVisionOptions): Promise<AiCompletionResult> {
  const allProviders = await getVisionProviders()
  if (allProviders.length === 0) {
    throw new Error('AI 辨識尚未設定，請至管理員設定 → AI 設定中配置 API')
  }

  const needsVision = !!(options.imageBase64 && options.mimeType)
  const candidates = needsVision
    ? allProviders.filter(p => p.supportsImage)
    : allProviders

  if (candidates.length === 0) {
    throw new Error('沒有支援圖片辨識的 API，請至管理員設定中新增支援圖片的模型')
  }

  const errors: string[] = []
  for (const provider of candidates) {
    try {
      return await callOpenaiCompatible(provider, options)
    } catch (e) {
      errors.push(`${provider.name}: ${(e as Error).message}`)
    }
  }
  throw new Error(`所有 API 均呼叫失敗：\n${errors.join('\n')}`)
}

/**
 * Send a streaming chat request (SSE format).
 * Supports LM Studio (OpenAI SSE) and Ollama (newline-delimited JSON).
 * Falls back: lmstudio → ollama.
 */
export async function aiChatStream(options: AiCompletionOptions): Promise<ReadableStream> {
  const provider = options.provider ?? getConfig().provider

  if (provider === 'lmstudio' || provider === 'ollama') {
    try {
      if (provider === 'lmstudio') return await lmstudioChatStream(options)
      return await ollamaChatStream(options)
    } catch {
      if (provider === 'lmstudio') {
        try { return await ollamaChatStream(options) } catch { /* fall through */ }
      }
    }
  }

  return ollamaChatStream(options)
}

/**
 * Check LM Studio health by sending a minimal request.
 */
export async function lmstudioHealth(): Promise<{
  ok: boolean
  model?: string
  error?: string
}> {
  const config = getConfig()
  const baseUrl = config.lmstudio.url.replace(/\/chat\/completions$/, '')
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const models = (data.data ?? []).map((m: { id: string }) => m.id)
    return { ok: true, model: models[0] ?? config.lmstudio.model }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Check if Ollama server is reachable and list available models.
 */
export async function ollamaHealth(): Promise<{
  ok: boolean
  models?: string[]
  error?: string
}> {
  const { baseUrl } = getConfig().ollama
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const models = (data.models ?? []).map((m: { name: string }) => m.name)
    return { ok: true, models }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Check all AI providers and return combined status.
 */
export async function aiHealth(): Promise<Record<string, { ok: boolean; detail?: string }>> {
  const [lm, ol] = await Promise.allSettled([lmstudioHealth(), ollamaHealth()])

  const lmResult = lm.status === 'fulfilled' ? lm.value : { ok: false, error: (lm as PromiseRejectedResult).reason?.message }
  const olResult = ol.status === 'fulfilled' ? ol.value : { ok: false, error: (ol as PromiseRejectedResult).reason?.message }

  return {
    lmstudio: { ok: lmResult.ok, detail: lmResult.ok ? `model: ${(lmResult as { model?: string }).model}` : lmResult.error },
    ollama: { ok: olResult.ok, detail: olResult.ok ? `models: ${((olResult as { models?: string[] }).models ?? []).join(', ')}` : olResult.error },
    anthropic: { ok: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? 'API key configured' : 'no API key' },
  }
}

/**
 * Get the current AI configuration.
 */
export function getAiConfig() {
  const config = getConfig()
  return {
    provider: config.provider,
    fallbackChain: FALLBACK_CHAIN.slice(FALLBACK_CHAIN.indexOf(config.provider)),
    lmstudioUrl: config.lmstudio.url,
    lmstudioModel: config.lmstudio.model,
    ollamaUrl: config.ollama.baseUrl,
    ollamaModel: config.ollama.model,
    anthropicModel: config.anthropic.model,
  }
}

// ── ERP-specific AI helpers ──────────────────────────────────────────────────

const ERP_SYSTEM_PROMPT = `你是 ComfortPlus ERP 的 AI 助手「小幫手」。你的任務是協助使用者操作 ERP 系統，包含：

1. **訂單分析** — 分析訂單趨勢、異常、建議
2. **客戶洞察** — 客戶消費模式、回購分析、流失風險
3. **庫存建議** — 補貨建議、滯銷品識別、安全庫存調整
4. **業績分析** — 業務績效、通路分析、目標追蹤
5. **日常操作** — 協助填寫表單、查詢資料、產生報表

回覆規則：
- 使用繁體中文回答
- 簡潔實用，避免冗長
- 涉及數字時用表格呈現
- 給出可執行的建議，不要空泛建議
- 如果需要更多資料才能回答，明確告知使用者需要什麼`

/**
 * AI chat with ERP context pre-loaded.
 */
export async function erpAiChat(
  userMessage: string,
  context?: string,
  history?: AiMessage[],
): Promise<AiCompletionResult> {
  const messages: AiMessage[] = [
    { role: 'system', content: ERP_SYSTEM_PROMPT + (context ? `\n\n以下是相關的系統數據：\n${context}` : '') },
    ...(history ?? []),
    { role: 'user', content: userMessage },
  ]

  return aiChat({ messages, temperature: 0.4 })
}

/**
 * Analyze structured data and return insights.
 */
export async function erpAiAnalyze(
  analysisType: 'order' | 'customer' | 'inventory' | 'sales',
  data: unknown,
): Promise<AiCompletionResult> {
  const prompts: Record<string, string> = {
    order: '分析以下訂單數據，找出趨勢和異常，給出可執行的建議：',
    customer: '分析以下客戶數據，識別消費模式、回購週期、流失風險，給出客戶經營建議：',
    inventory: '分析以下庫存數據，識別需要補貨的商品、滯銷品，建議安全庫存調整：',
    sales: '分析以下業績數據，比較各業務表現、通路趨勢，給出業務策略建議：',
  }

  const messages: AiMessage[] = [
    { role: 'system', content: ERP_SYSTEM_PROMPT },
    { role: 'user', content: `${prompts[analysisType]}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` },
  ]

  return aiChat({ messages, temperature: 0.3, maxTokens: 4096 })
}
