import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * Token Rotation 策略（鏡像玉米筍 ERP 的 Refresh Token 設計）
 *
 * - Access JWT 有效期 15 分鐘（短期）
 * - JWT callback 每次觸發時自動檢查：若距到期不足 5 分鐘 → 自動延展（sliding window）
 * - 最大 session 壽命 8 小時（工作日上限）
 * - tokenVersion：每次 user 改密碼或管理員強制登出時遞增，
 *   所有既存 JWT 在下次 jwt callback 時失效
 *
 * 撤銷方式：
 *   await prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } })
 *   → 該用戶所有 session 於 ≤15 分鐘內失效
 */

const ACCESS_TOKEN_MAX_AGE = 15 * 60          // 15 min
const SESSION_ABSOLUTE_MAX_AGE = 8 * 60 * 60  // 8 hours
const REFRESH_WINDOW = 5 * 60                  // Refresh if < 5 min remaining

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: '密碼', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.isActive) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password ?? ''
        )

        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const email = profile?.email
        if (!email) return false
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { isActive: true },
        })
        // Only allow Google sign-in for existing active users
        return !!(dbUser?.isActive)
      }
      return true
    },
    async jwt({ token, user, account }) {
      const now = Math.floor(Date.now() / 1000)

      // Initial sign-in: populate token
      if (user) {
        if (account?.provider === 'google') {
          // Fetch our DB user by email (Google user.id is the Google sub, not our DB id)
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { id: true, role: true, tokenVersion: true },
          })
          if (!dbUser) return { ...token, error: 'UserNotFound' }
          token.id = dbUser.id
          token.role = dbUser.role
          token.tokenVersion = dbUser.tokenVersion
        } else {
          token.id = user.id
          token.role = (user as any).role
          token.tokenVersion = (user as any).tokenVersion ?? 0
        }
        token.issuedAt = now
        token.absoluteExpiry = now + SESSION_ABSOLUTE_MAX_AGE
        token.accessExpiry = now + ACCESS_TOKEN_MAX_AGE
        return token
      }

      // Subsequent requests: check revocation + sliding window refresh
      const absoluteExpiry = (token.absoluteExpiry as number) ?? 0
      const accessExpiry = (token.accessExpiry as number) ?? 0

      // 1. Absolute session expired (8hr hard limit)
      if (now >= absoluteExpiry) {
        return { ...token, error: 'SessionExpired' }
      }

      // 2. Access token expired — verify tokenVersion from DB before refreshing
      if (now >= accessExpiry - REFRESH_WINDOW) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true, isActive: true, role: true },
          })

          // User deleted, deactivated, or tokenVersion bumped → revoke
          if (!dbUser || !dbUser.isActive || dbUser.tokenVersion !== token.tokenVersion) {
            return { ...token, error: 'TokenRevoked' }
          }

          // Refresh: extend access window, update role if changed
          token.accessExpiry = now + ACCESS_TOKEN_MAX_AGE
          token.role = dbUser.role
        } catch {
          // DB unavailable — allow current token to finish its window
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.error === 'SessionExpired' || token.error === 'TokenRevoked') {
        // Signal client to re-authenticate
        return { ...session, error: token.error as string }
      }
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_ABSOLUTE_MAX_AGE,
  },
})
