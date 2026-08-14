#!/bin/bash
set -e

npm install @auth/prisma-adapter

cat > src/auth.ts << 'EOF'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
EOF

cat > src/types/next-auth.d.ts << 'EOF'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: string
    } & DefaultSession['user']
  }
}
EOF

cat > src/components/real-like-button.tsx << 'EOF'
'use client'

import { useState, useTransition } from 'react'

export default function RealLikeButton({
  promptId,
  initialLiked,
  initialCount,
  label,
  requireLogin,
}: {
  promptId: string
  initialLiked: boolean
  initialCount: number
  label: string
  requireLogin: string
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setCount((c) => c + (newLiked ? 1 : -1))
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, action: newLiked ? 'like' : 'unlike' }),
    })
    if (res.status === 401) {
      alert(requireLogin)
      setLiked(!newLiked)
      setCount((c) => c + (newLiked ? -1 : 1))
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(toggle)}
      disabled={pending}
      className={liked ? 'btn-primary' : 'btn-secondary'}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
      </svg>
      {count} {label}
    </button>
  )
}
EOF

cat > src/components/real-comment-box.tsx << 'EOF'
'use client'

import { useState } from 'react'

type Comment = { id: string; name: string; image?: string | null; text: string; createdAt: string }

export default function RealCommentBox({
  initial,
  targetId,
  targetType,
  titleLabel,
  textPlaceholder,
  submitLabel,
  loginRequired,
  isLoggedIn,
}: {
  initial: Comment[]
  targetId: string
  targetType: 'prompt' | 'article'
  titleLabel: string
  textPlaceholder: string
  submitLabel: string
  loginRequired: string
  isLoggedIn: boolean
}) {
  const [list, setList] = useState<Comment[]>(initial)
  const [text, setText] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!isLoggedIn) {
      alert(loginRequired)
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), targetId, targetType }),
    })
    if (res.ok) {
      const newComment = await res.json()
      setList([newComment, ...list])
      setText('')
    }
  }

  return (
    <div className="card mt-10 p-6">
      <h3 className="font-display text-lg font-bold">{titleLabel}</h3>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="input resize-none"
        />
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {list.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-elevated p-4">
            <div className="flex items-center gap-3">
              {c.image ? (
                <img src={c.image} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold-bright">
                  {c.name[0]}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gold-bright">{c.name}</p>
                <p className="text-[10px] text-ink-faint">{c.createdAt}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-muted">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

mkdir -p src/app/api/likes src/app/api/comments

cat > src/app/api/likes/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { promptId, action } = await req.json()
  if (!promptId || !['like', 'unlike'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const userId = session.user.id

  if (action === 'like') {
    await prisma.like.create({ data: { userId, promptId } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { likes: { increment: 1 } },
    }).catch(() => {})
  } else {
    await prisma.like.delete({ where: { userId_promptId: { userId, promptId } } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { likes: { decrement: 1 } },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
EOF

cat > src/app/api/comments/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { text, targetId, targetType } = await req.json()
  if (!text || !targetId || !['prompt', 'article'].includes(targetType)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const data: any = {
    name: session.user.name ?? 'کاربر',
    text,
    userId: session.user.id,
  }
  if (targetType === 'prompt') data.promptId = targetId
  if (targetType === 'article') data.articleId = targetId

  const comment = await prisma.comment.create({
    data,
    include: { user: true },
  })

  return NextResponse.json({
    id: comment.id,
    name: session.user.name ?? 'کاربر',
    image: session.user.image ?? null,
    text: comment.text,
    createdAt: new Date(comment.createdAt).toLocaleString('fa-IR'),
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get('id')
  const targetType = searchParams.get('type')

  if (!targetId || !['prompt', 'article'].includes(targetType ?? '')) {
    return NextResponse.json([], { status: 400 })
  }

  const where: any = {}
  if (targetType === 'prompt') where.promptId = targetId
  if (targetType === 'article') where.articleId = targetId

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      name: c.user?.name ?? c.name,
      image: c.user?.image ?? null,
      text: c.text,
      createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
    }))
  )
}
EOF

echo "✅ Real auth + likes + comments wired up!"