import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

const useSecureCookies = process.env.NODE_ENV === 'production' || !!process.env.VERCEL

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      id: 'telegram',
      name: 'Telegram',
      credentials: {
        id: { label: 'Telegram ID', type: 'text' },
        userId: { label: 'User ID', type: 'text' },
        telegramId: { label: 'Telegram ID', type: 'text' },
      },
      async authorize(credentials) {
        const targetId = credentials?.userId || credentials?.id || credentials?.telegramId
        if (!targetId) return null

        const idStr = String(targetId)
        let user = null

        if (idStr.length === 25 && idStr.startsWith('c')) {
          user = await prisma.user.findUnique({ where: { id: idStr } })
        } else {
          user = await prisma.user.findFirst({ where: { telegram: idStr } })
          if (!user) {
            try {
              user = await prisma.user.create({
                data: {
                  telegram: idStr,
                  name: 'کاربر تلگرام',
                  email: `telegram_${idStr}@promptfa.local`,
                },
              })
            } catch {
              return null
            }
          }
        }

        return user
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? '__Secure-' : ''}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${useSecureCookies ? '__Secure-' : ''}authjs.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? '__Host-' : ''}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, email: true },
        })
        token.role = dbUser?.role ?? 'USER'
        token.email = dbUser?.email
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.email = token.email as string
      }
      return session
    },
  },
})
