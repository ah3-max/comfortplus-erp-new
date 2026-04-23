import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role?: string
    tokenVersion?: number
    avatar?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      avatar?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    tokenVersion?: number
    issuedAt?: number
    absoluteExpiry?: number
    accessExpiry?: number
    error?: string
  }
}
