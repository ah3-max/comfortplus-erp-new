/**
 * Structured Logger
 *
 * Outputs JSON logs for easy parsing by log aggregators (Datadog, Loki, etc.)
 * In development, outputs human-readable format.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const IS_PROD = process.env.NODE_ENV === 'production'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  requestId?: string
  error?: string
  stack?: string
  data?: Record<string, unknown>
  timestamp: string
}

function formatLog(entry: LogEntry): string {
  if (IS_PROD) {
    return JSON.stringify(entry)
  }
  // Dev: human-readable
  const prefix = {
    info: '\x1b[36mINFO\x1b[0m',
    warn: '\x1b[33mWARN\x1b[0m',
    error: '\x1b[31mERROR\x1b[0m',
    debug: '\x1b[90mDEBUG\x1b[0m',
  }[entry.level]
  const mod = `\x1b[35m[${entry.module}]\x1b[0m`
  let line = `${prefix} ${mod} ${entry.message}`
  if (entry.error) line += ` — ${entry.error}`
  if (entry.data) line += ` ${JSON.stringify(entry.data)}`
  return line
}

function log(level: LogLevel, module: string, message: string, extra?: { error?: unknown; data?: Record<string, unknown>; requestId?: string }) {
  const entry: LogEntry = {
    level,
    module,
    message,
    ...(extra?.requestId && { requestId: extra.requestId }),
    timestamp: new Date().toISOString(),
  }

  if (extra?.error) {
    const err = extra.error instanceof Error ? extra.error : new Error(String(extra.error))
    entry.error = err.message
    if (level === 'error') entry.stack = err.stack
  }

  if (extra?.data) entry.data = extra.data

  const output = formatLog(entry)

  switch (level) {
    case 'error': console.error(output); break
    case 'warn':  console.warn(output); break
    case 'debug': if (!IS_PROD) console.debug(output); break
    default:      console.log(output)
  }
}

export const logger = {
  info:  (module: string, message: string, data?: Record<string, unknown>) => log('info', module, message, { data }),
  warn:  (module: string, message: string, data?: Record<string, unknown>) => log('warn', module, message, { data }),
  error: (module: string, message: string, error?: unknown, data?: Record<string, unknown>) => log('error', module, message, { error, data }),
  debug: (module: string, message: string, data?: Record<string, unknown>) => log('debug', module, message, { data }),
}

/** Extract X-Request-ID from incoming request headers (injected by middleware) */
export function getRequestId(req: { headers: { get(name: string): string | null } }): string | undefined {
  return req.headers.get('X-Request-ID') ?? undefined
}
