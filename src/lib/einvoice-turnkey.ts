/**
 * Turnkey File Packaging Utilities
 *
 * 處理：
 * 1. InvoiceEnvelope XML 封裝
 * 2. 檔案命名規則 (v41-{type}-{date}-{time}-{uuid})
 * 3. UpCast 目錄結構 (B2SSTORAGE/{messageType}/SRC/)
 * 4. 批次合併規則 (B2S storage: max 1000筆 or 15MB)
 */

import { randomUUID } from 'crypto'
import type { MigMessageType } from './einvoice-mig'

// ── InvoiceEnvelope XML ────────────────────────────────

export interface EnvelopeParams {
  fromPartyId: string        // 賣方統編
  fromRoutingId?: string     // 加值中心代碼 (PSxxxxxx)
  toPartyId: string          // 買方統編 (B2S: 0000000000)
  toRoutingId?: string       // 平台代碼 (EINVCT01)
  messageType: MigMessageType
  invoiceXml: string         // 內層 XML 內容
  messageCount?: number      // 批次筆數 (default 1)
}

export function buildInvoiceEnvelope(params: EnvelopeParams): string {
  const {
    fromPartyId,
    fromRoutingId = 'PS000001',
    toPartyId,
    toRoutingId = 'EINVCT01',
    messageType,
    invoiceXml,
    messageCount = 1,
  } = params

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceEnvelope>
  <From>
    <PartyId>${escapeXml(fromPartyId)}</PartyId>
  </From>
  <FromVAC>
    <RoutingId>${escapeXml(fromRoutingId)}</RoutingId>
  </FromVAC>
  <To>
    <PartyId>${escapeXml(toPartyId)}</PartyId>
  </To>
  <ToVAC>
    <RoutingId>${escapeXml(toRoutingId)}</RoutingId>
  </ToVAC>
  <InvoicePack count="${messageCount}" messageType="${messageType}" version="v41">
${invoiceXml}
  </InvoicePack>
</InvoiceEnvelope>`
}

// ── File Naming ────────────────────────────────────────

export interface TurnkeyFileName {
  version: string
  messageType: MigMessageType
  msgDate: string         // YYYYMMDD
  msgTime: string         // HHMMSSmmm
  uuid: string
}

export function generateTurnkeyFileName(messageType: MigMessageType): TurnkeyFileName {
  const now = new Date()
  const version = 'v41'
  const msgDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')

  const msgTime = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('')

  const uuid = randomUUID()

  return { version, messageType, msgDate, msgTime, uuid }
}

export function formatTurnkeyFileName(info: TurnkeyFileName): string {
  return `${info.version}-${info.messageType}-${info.msgDate}-${info.msgTime}-${info.uuid}`
}

// ── Directory Structure ────────────────────────────────

export interface TurnkeyPaths {
  workPath: string
  upcastDir: string
  srcDir: string
  fullPath: string
}

export function resolveTurnkeyPaths(
  workPath: string,
  messageType: MigMessageType,
  fileName: string,
): TurnkeyPaths {
  const upcastDir = `${workPath}/UpCast/B2SSTORAGE/${messageType}`
  const srcDir = `${upcastDir}/SRC`
  const fullPath = `${srcDir}/${fileName}`
  return { workPath, upcastDir, srcDir, fullPath }
}

// ── Batch Rules ────────────────────────────────────────

const MAX_BATCH_COUNT = 1000
const MAX_BATCH_SIZE_BYTES = 15 * 1024 * 1024

export interface BatchResult {
  batchIndex: number
  fileName: string
  content: string
  invoiceCount: number
  sizeBytes: number
}

export function batchInvoiceXmls(
  xmlContents: string[],
  messageType: MigMessageType,
  sellerTaxId: string,
): BatchResult[] {
  const results: BatchResult[] = []
  let currentBatch: string[] = []
  let currentSize = 0
  let batchIndex = 0

  const flush = () => {
    if (currentBatch.length === 0) return

    const combined = currentBatch.join('\n')
    const envelope = buildInvoiceEnvelope({
      fromPartyId: sellerTaxId,
      toPartyId: '0000000000',
      messageType,
      invoiceXml: combined,
      messageCount: currentBatch.length,
    })

    const fileInfo = generateTurnkeyFileName(messageType)
    const fileName = formatTurnkeyFileName(fileInfo)

    results.push({
      batchIndex,
      fileName,
      content: envelope,
      invoiceCount: currentBatch.length,
      sizeBytes: Buffer.byteLength(envelope, 'utf-8'),
    })

    batchIndex++
    currentBatch = []
    currentSize = 0
  }

  for (const xml of xmlContents) {
    const xmlSize = Buffer.byteLength(xml, 'utf-8')

    if (currentBatch.length >= MAX_BATCH_COUNT || (currentSize + xmlSize > MAX_BATCH_SIZE_BYTES && currentBatch.length > 0)) {
      flush()
    }

    currentBatch.push(xml)
    currentSize += xmlSize
  }

  flush()
  return results
}

// ── ProcessResult Parsing ──────────────────────────────

export interface ProcessResultEntry {
  invoiceNumber: string
  code: string
  description: string
  parameter0?: string
  parameter1?: string
  isSuccess: boolean
}

export function parseProcessResultXml(xml: string): ProcessResultEntry[] {
  const results: ProcessResultEntry[] = []
  const messageRegex = /<Message>([\s\S]*?)<\/Message>/g
  let match: RegExpExecArray | null

  while ((match = messageRegex.exec(xml)) !== null) {
    const block = match[1]
    const code = extractTag(block, 'Code') ?? ''
    const description = extractTag(block, 'Description') ?? ''
    const parameter0 = extractTag(block, 'Parameter0') ?? undefined
    const parameter1 = extractTag(block, 'Parameter1') ?? undefined
    const invoiceNumber = parameter0 ?? ''

    results.push({
      invoiceNumber,
      code,
      description,
      parameter0,
      parameter1,
      isSuccess: code === '00000',
    })
  }

  return results
}

// ── SummaryResult Parsing ──────────────────────────────

export interface SummaryResultEntry {
  messageType: string
  total: number
  good: number
  failed: number
}

export function parseSummaryResultXml(xml: string): SummaryResultEntry[] {
  const results: SummaryResultEntry[] = []
  const messageRegex = /<Message>([\s\S]*?)<\/Message>/g
  let match: RegExpExecArray | null

  while ((match = messageRegex.exec(xml)) !== null) {
    const block = match[1]
    results.push({
      messageType: extractTag(block, 'MessageType') ?? '',
      total: Number(extractTag(block, 'Total') ?? '0'),
      good: Number(extractTag(block, 'Good') ?? '0'),
      failed: Number(extractTag(block, 'Failed') ?? '0'),
    })
  }

  return results
}

// ── Internal Helpers ───────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  const match = regex.exec(xml)
  return match ? match[1].trim() : null
}
