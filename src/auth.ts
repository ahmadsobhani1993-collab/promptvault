import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma), // برای گوگل همچنان لازم است
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
        console.log("🔍 [AUTH] authorize called with credentials:", credentials)
        
        const targetId = credentials?.userId || credentials?.id || credentials?.telegramId
        
        if (!targetId) {
          console.error("❌ [AUTH] No ID provided in credentials")
          return null
        }

        const idStr = String(targetId)
        let user = null

        // تشخیص نوع آیدی: اگر ۲۵ کاراکتر باشد و با c شروع شود، Prisma CUID است
        if (idStr.length === 25 && idStr.startsWith('c')) {
          console.log("🔍 [AUTH] Detected Prisma CUID, searching by id:", idStr)
          user = await prisma.user.findUnique({ where: { id: idStr } })
        } else {
          // در غیر این صورت، آیدی عددی تلگرام است
          console.log("🔍 [AUTH] Detected Telegram Numeric ID, searching by telegram:", idStr)
          user = await prisma.user.findFirst({ where: { telegram: idStr } })
          
          if (!user) {
            console.log("⚠️ [AUTH] User not found. Creating new user for Telegram ID:", idStr)
            try {
              user = await prisma.user.create({
                data: {
                  telegram: idStr,
                  name: 'کاربر تلگرام',
                  email: `telegram_${idStr}@promptfa.local`, 
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
        }

        if (user) {
          console.log("✅ [AUTH] Login successful, returning user:", user.id)
          return user
        }
        
        console.error("❌ [AUTH] User not found and could not be created")
        return null
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  
  // ✅ تغییر کلیدی: استفاده از JWT به جای دیتابیس برای سشن
  session: { strategy: 'jwt' }, 
  
  pages: { signIn: '/login' },
  
  callbacks: {
    // ۱. کالبک JWT: اطلاعات کاربر را در توکن رمزنگاری‌شده ذخیره می‌کند
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // دریافت نقش و ایمیل برای ذخیره در توکن
        const dbUser = await prisma.user.findUnique({ 
          where: { id: user.id }, 
          select: { role: true, email: true } 
        })
        token.role = dbUser?.role ?? 'USER'
        token.email = dbUser?.email
      }
      return token
    },
    
    // ۲. کالبک Session: اطلاعات را از توکن خوانده و به سشن تزریق می‌کند
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.email = token.email as string
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