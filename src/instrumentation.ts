/**
 * Next.js Instrumentation — runs once at server startup.
 * Fails fast in production if required secrets are missing or too short.
 */
export async function register() {
  if (process.env.NODE_ENV !== 'production') return

  const errors: string[] = []
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    errors.push('CRON_SECRET missing or <32 chars — cron endpoints would be unprotected')
  }
  // Accept either NEXTAUTH_SECRET (NextAuth v4 naming) or AUTH_SECRET (v5)
  const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  if (!authSecret || authSecret.length < 32) {
    errors.push('NEXTAUTH_SECRET/AUTH_SECRET missing or <32 chars — session security compromised')
  }

  if (errors.length > 0) {
    console.error('[SECURITY] Production startup blocked:')
    for (const e of errors) console.error('  ✗ ' + e)
    console.error('[SECURITY] Generate secrets with: openssl rand -base64 32')
    throw new Error('Production misconfiguration: ' + errors.join('; '))
  }
  console.info('[STARTUP] Security pre-flight passed. Run GET /api/settings/security-check as SUPER_ADMIN for full posture check.')
}
