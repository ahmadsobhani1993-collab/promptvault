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
        telegramId: { label: 'Telegram ID', type: 'text' }, // تغییر از userId به telegramId
      },
      async authorize(credentials) {
        if (!credentials?.telegramId) return null

        // ۱. جستجوی کاربر بر اساس آیدی تلگرام (نه id دیتابیس)
        let user = await prisma.user.findFirst({
          where: { telegram: credentials.telegramId },
        })

        // ۲. اگر کاربر وجود نداشت (سناریوی ۲: اولین بار با تلگرام)، حساب جدید می‌سازیم
        if (!user) {
          user = await prisma.user.create({
            data: {
              telegram: credentials.telegramId,
              name: 'کاربر تلگرام',
              // ایمیل موقت یکتا برای عبور از قید unique دیتابیس، تا کاربر بعداً آن را ست کند
              email: `telegram_${credentials.telegramId}@promptfa.local`, 
            },
          })
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
          select: { role: true, email: true } 
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