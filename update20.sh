#!/bin/bash
set -e

cat > src/app/api/debug/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const envs = {
    AUTH_SECRET: !!process.env.AUTH_SECRET ? 'set (' + process.env.AUTH_SECRET!.length + ' chars)' : 'MISSING',
    AUTH_URL: process.env.AUTH_URL || 'MISSING',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID ? 'set (ends: ...' + process.env.AUTH_GOOGLE_ID!.slice(-10) + ')' : 'MISSING',
    AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET ? 'set (' + process.env.AUTH_GOOGLE_SECRET!.length + ' chars)' : 'MISSING',
    DATABASE_URL: !!process.env.DATABASE_URL ? 'set' : 'MISSING',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'MISSING',
  }

  let dbStatus: string
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'OK'
  } catch (e: any) {
    dbStatus = 'ERROR: ' + (e?.message ?? String(e))
  }

  let userCount: number | string
  try {
    userCount = await prisma.user.count()
  } catch (e: any) {
    userCount = 'ERROR: ' + (e?.message ?? String(e))
  }

  return NextResponse.json({
    envs,
    db: dbStatus,
    userCount,
    time: new Date().toISOString(),
  })
}
EOF

cat > src/auth.ts << 'EOF'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
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
EOF

echo "✅ Debug endpoint + detailed auth logging added!"