import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const SESSION_MAX_AGE = 24 * 60 * 60  // 24hr — 客戶 Portal 不限工作日

export const {
  handlers: portalHandlers,
  signIn: portalSignIn,
  signOut: portalSignOut,
  auth: portalAuth,
} = NextAuth({
  providers: [
    ...(process.env.PORTAL_GOOGLE_CLIENT_ID && process.env.PORTAL_GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.PORTAL_GOOGLE_CLIENT_ID,
          clientSecret: process.env.PORTAL_GOOGLE_CLIENT_SECRET,
        })]
      : []),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: '密碼', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const account = await prisma.portalAccount.findUnique({
          where: { email: credentials.email as string },
          include: { customer: { select: { id: true, name: true, code: true } } },
        })

        if (!account || !account.isActive) return null

        const match = await bcrypt.compare(
          credentials.password as string,
          account.passwordHash
        )
        if (!match) return null

        await prisma.portalAccount.update({
          where: { id: account.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: account.id,
          email: account.email,
          name: account.customer.name,
          customerId: account.customerId,
          customerCode: account.customer.code,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const googleId = profile?.sub
        const email = profile?.email
        if (!googleId && !email) return false

        const portalAccount = await prisma.portalAccount.findFirst({
          where: googleId
            ? { OR: [{ googleId }, { email: email ?? '' }] }
            : { email: email ?? '' },
          select: { isActive: true, googleId: true, id: true },
        })
        if (!portalAccount?.isActive) return false

        // Auto-link Google ID on first Google sign-in
        if (!portalAccount.googleId && googleId) {
          await prisma.portalAccount.update({
            where: { id: portalAccount.id },
            data: { googleId, lastLoginAt: new Date() },
          })
        } else {
          await prisma.portalAccount.update({
            where: { id: portalAccount.id },
            data: { lastLoginAt: new Date() },
          })
        }
        return true
      }
      return true
    },
    async jwt({ token, user, account }) {
      // Initial sign-in
      if (user) {
        if (account?.provider === 'google') {
          const portalAccount = await prisma.portalAccount.findFirst({
            where: { OR: [{ googleId: account.providerAccountId }, { email: user.email! }] },
            include: { customer: { select: { id: true, code: true } } },
          })
          if (!portalAccount) return { ...token, error: 'AccountNotFound' }
          token.accountId = portalAccount.id
          token.customerId = portalAccount.customerId
          token.customerCode = portalAccount.customer.code
        } else {
          token.accountId = user.id
          token.customerId = (user as { customerId?: string }).customerId
          token.customerCode = (user as { customerCode?: string }).customerCode
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.accountId as string
        ;(session.user as unknown as Record<string, unknown>).customerId = token.customerId
        ;(session.user as unknown as Record<string, unknown>).customerCode = token.customerCode
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.portal-session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/portal', secure: process.env.NODE_ENV === 'production' },
    },
  },
  pages: {
    signIn: '/portal/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },
})
