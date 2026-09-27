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
        id: { label: 'Telegram ID', type: 'text' },
        userId: { label: 'User ID', type: 'text' },
        telegramId: { label: 'Telegram ID', type: 'text' },
      },
      async authorize(credentials) {
        console.log("🔍 [AUTH] Credentials received:", credentials)
        
        // ۱. اگر userId مستقیماً ارسال شده باشد (مثلاً از callback تلگرام)، مستقیماً کاربر را پیدا کن
        if (credentials?.userId) {
          const user = await prisma.user.findUnique({
            where: { id: String(credentials.userId) },
          })
          if (user) {
            console.log("✅ [AUTH] User found by userId:", user.id)
            return user
          }
        }

        // ۲. در غیر این صورت، بر اساس آیدی تلگرام جستجو کن
        const tgId = credentials?.id || credentials?.telegramId
        if (tgId) {
          const tgIdStr = String(tgId)
          console.log("🔍 [AUTH] Searching for user with telegram ID:", tgIdStr)

          let user = await prisma.user.findFirst({
            where: { telegram: tgIdStr },
          })

          if (!user) {
            console.log("⚠️ [AUTH] User not found. Creating new user...")
            try {
              user = await prisma.user.create({
                data: {
                  telegram: tgIdStr,
                  name: 'کاربر تلگرام',
                  email: `telegram_${tgIdStr}@promptfa.local`, 
                },
              })
              console.log("✅ [AUTH] New user created with ID:", user.id)
            } catch (error) {
              console.error("❌ [AUTH] Failed to create user:", error)
              return null
            }
          } else {
            console.log("✅ [AUTH] Existing user found with ID:", user.id)
          }

          return user
        }

        console.error("❌ [AUTH] No valid credentials provided!")
        return null
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id
        
        const dbUser = await prisma.user.findUnique({ 
          where: { id: user.id }, 
          select: { role: true, email: true, telegram: true, telegramHandle: true } 
        })
        
        let role = dbUser?.role ?? 'USER'
        
        if (
          process.env.ADMIN_EMAIL &&
          dbUser?.email === process.env.ADMIN_EMAIL &&
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