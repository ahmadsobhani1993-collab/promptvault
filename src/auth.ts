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
        // دریافت آیدی تلگرام از هر کدام از کلیدهای ممکن که ممکن است ارسال شده باشد
        const tgId = credentials?.id || credentials?.userId || credentials?.telegramId
        
        if (!tgId) {
          console.error('[AUTH] Telegram ID is missing in credentials:', credentials)
          return null
        }

        const tgIdStr = String(tgId)

        // ۱. جستجوی کاربر بر اساس آیدی عددی تلگرام (فیلد telegram در prisma)
        let user = await prisma.user.findFirst({
          where: { telegram: tgIdStr },
        })

        // ۲. اگر کاربر وجود نداشت (اولین بار است با تلگرام وارد می‌شود)، حساب جدید می‌سازیم
        if (!user) {
          try {
            user = await prisma.user.create({
              data: {
                telegram: tgIdStr,
                name: 'کاربر تلگرام',
                // یک ایمیل موقت یکتا برای عبور از قید unique دیتابیس
                email: `telegram_${tgIdStr}@promptfa.local`, 
              },
            })
          } catch (error) {
            console.error('[AUTH] Failed to create Telegram user:', error)
            return null
          }
        }

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