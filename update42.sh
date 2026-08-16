#!/bin/bash
set -e

mkdir -p public
mkdir -p src/app/api/push/subscribe
mkdir -p src/app/api/push/send
mkdir -p src/app/api/push/vapid-key

# ---------- 1) PWA manifest ----------
cat > public/manifest.json << 'EOF'
{
  "name": "PromptsFA",
  "short_name": "PromptsFA",
  "description": "پلتفرم پرامپت‌های هوش مصنوعی",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0805",
  "theme_color": "#d4a94e",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

# ---------- 2) Service Worker ----------
cat > public/sw.js << 'EOF'
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'PromptsFA', body: 'خبر جدید!' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url ?? '/',
      dir: 'rtl',
      lang: 'fa',
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) if (c.url.includes(url) && 'focus' in c) return c.focus()
      return self.clients.openWindow(url)
    })
  )
})
EOF

# ---------- 3) VAPID key generation (one-time) ----------
node << 'NODEEOF'
const fs = require('fs')
const crypto = require('crypto')
const file = '.vapid-keys.json'
if (!fs.existsSync(file)) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  fs.writeFileSync(file, JSON.stringify({ publicKey, privateKey }))
  console.log('✅ VAPID keys generated')
} else {
  console.log('⚠️ VAPID keys already exist')
}
NODEEOF

# ---------- 4) Push subscription API ----------
cat > src/app/api/push/subscribe/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { keys: JSON.stringify(keys) },
    create: { endpoint, keys: JSON.stringify(keys), userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
EOF

# ---------- 5) Push send API ----------
cat > src/app/api/push/send/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import webpush from 'web-push'
import fs from 'fs'

const vapidKeys = JSON.parse(fs.readFileSync('.vapid-keys.json', 'utf8'))

webpush.setVapidDetails('mailto:admin@promptsfa.ir', vapidKeys.publicKey, vapidKeys.privateKey)

export async function POST(req: Request) {
  const { userId, title, body, url } = await req.json()
  if (!userId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) },
        JSON.stringify({ title, body, url })
      )
      sent++
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
EOF

# ---------- 6) Install + notify buttons ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [installable, setInstallable] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)

    const handler = (e: any) => {
      e.preventDefault()
      setInstallable(true)
      ;(window as any).deferredPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    const prompt = (window as any).deferredPrompt
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setInstallable(false)
  }

  const enableNotifications = async () => {
    if (permission === 'denied') {
      alert('لطفاً در تنظیمات مرورگر، نوتیفیکیشن را مجاز کن.')
      return
    }
    setNotifying(true)
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await getVapidPublicKey(),
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      alert('✅ نوتیفیکیشن فعال شد!')
    }
    setNotifying(false)
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-xs text-success">
        <span>✅ نوتیفیکیشن فعال</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {installable && (
        <button type="button" onClick={install} className="btn-secondary text-xs">
          📲 نصب اپ
        </button>
      )}
      <button type="button" onClick={enableNotifications} disabled={notifying} className="btn-secondary text-xs">
        {notifying ? '...' : '🔔 فعال‌سازی نوتیفیکیشن'}
      </button>
    </div>
  )
}

async function getVapidPublicKey(): Promise<Uint8Array> {
  const res = await fetch('/api/push/vapid-key')
  const { publicKey } = await res.json()
  return urlBase64ToUint8Array(publicKey)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
EOF

cat > src/app/api/push/vapid-key/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import fs from 'fs'

export async function GET() {
  const vapidKeys = JSON.parse(fs.readFileSync('.vapid-keys.json', 'utf8'))
  const pub = vapidKeys.publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '')
  return NextResponse.json({ publicKey: pub })
}
EOF

# ---------- 7) Add PushSubscription to schema ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('model PushSubscription')) {
  s += '\nmodel PushSubscription {\n  id        String   @id @default(cuid())\n  endpoint  String   @unique\n  keys      String\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ schema: PushSubscription added')
}
NODEEOF

# ---------- 8) Hook into like/comment/approval ----------
node << 'NODEEOF'
const fs = require('fs')

// like action
let p = 'src/app/api/like/route.ts'
if (fs.existsSync(p)) {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('push/send')) {
    s = s.replace(
      'return NextResponse.json({ ok: true, likes: p.likes })',
      `const ownerId = p.userId
    if (ownerId && ownerId !== session.user.id) {
      await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerId, title: '❤️ لایک جدید', body: 'یک نفر پرامپت تو را پسندید!', url: '/prompts/' + p.slug }),
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, likes: p.likes })`
    )
    fs.writeFileSync(p, s)
    console.log('✅ like: push added')
  }
}

// comment action
p = 'src/app/api/comment/route.ts'
if (fs.existsSync(p)) {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('push/send')) {
    s = s.replace(
      'return NextResponse.json({ ok: true, comment: c })',
      `const prompt = await prisma.prompt.findUnique({ where: { id: promptId }, select: { userId: true, slug: true } })
    if (prompt?.userId && prompt.userId !== session.user.id) {
      await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: prompt.userId, title: '💬 کامنت جدید', body: 'یک نفر روی پرامپت تو نظر داد!', url: '/prompts/' + prompt.slug }),
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, comment: c })`
    )
    fs.writeFileSync(p, s)
    console.log('✅ comment: push added')
  }
}

// approval action (admin panel)
p = 'src/app/admin/prompt-actions.ts'
if (fs.existsSync(p)) {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('push/send')) {
    s = s.replace(
      'revalidatePath',
      `const prompt = await prisma.prompt.findUnique({ where: { id }, select: { userId: true, slug: true, titleFa: true } })
    if (prompt?.userId) {
      await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: prompt.userId, title: '✅ پرامپت تأیید شد', body: 'پرامپت "' + prompt.titleFa + '" منتشر شد!', url: '/prompts/' + prompt.slug }),
      }).catch(() => {})
    }
    revalidatePath`
    )
    fs.writeFileSync(p, s)
    console.log('✅ approval: push added')
  }
}
NODEEOF

# ---------- 9) Install web-push ----------
echo "Installing web-push..."
npm install web-push --save

echo "✅ PWA + Push Notifications files ready!"
echo ""
echo "⚠️ حالا باید db push را اجرا کنی. برای این کار:"
echo ""
echo "1) برو به Vercel → Settings → Environment Variables"
echo "2) مقدار DATABASE_URL را کپی کن"
echo "3) این دستور را بزن (جای DATABASE_URL مقدار واقعی را بگذار):"
echo ""
echo "   echo 'DATABASE_URL=\"YOUR_DATABASE_URL_HERE\"' > .env"
echo ""
echo "4) سپس:"
echo ""
echo "   npx prisma db push"
echo ""
echo "5) و در نهایت push کن:"
echo ""
echo "   git add . && git commit -m 'pwa + push' && git push"