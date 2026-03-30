/**
 * Next.js Instrumentation — runs once at server startup.
 * Used for security pre-flight checks.
 */
export async function register() {
  if (process.env.NODE_ENV === 'production') {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || cronSecret.length < 32) {
      console.warn('[SECURITY] CRON_SECRET is missing or too short (<32 chars). Cron endpoints are unprotected.')
    }
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      console.warn('[SECURITY] AUTH_SECRET is missing or too short. Session security may be compromised.')
    }
    console.info('[STARTUP] Run GET /api/settings/security-check as SUPER_ADMIN to verify security posture.')
  }
}
