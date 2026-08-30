import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

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
        userId: { label: 'User ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.userId) return null

        const user = await prisma.user.findUnique({
          where: { id: credentials.userId },
        })

        return user
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        let role = (user as any).role ?? 'USER'
        if (
          process.env.ADMIN_EMAIL &&
          session.user.email === process.env.ADMIN_EMAIL &&
          role !== 'ADMIN'
        ) {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
          role = 'ADMIN'
        }
        session.user.role = role
      }
      return session
    },
  },
  logger: {
    error(code, ...message) {
      console.error('[AUTH ERROR]', JSON.stringify({ code, message: message.map((m) => String(m)).join(' ') }))
    },
  },
})