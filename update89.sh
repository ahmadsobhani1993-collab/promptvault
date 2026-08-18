#!/bin/bash
set -e

# ---------- 1) bulletproof layout ----------
node << 'NODEEOF'
const fs = require('fs')

const hasSonner = fs.existsSync('src/components/ui/sonner.tsx')
const toasterImport = hasSonner ? "import { Toaster } from '@/components/ui/sonner'\n" : ''
const toasterUse = hasSonner ? '        <Toaster richColors position={locale === \'fa\' ? \'bottom-left\' : \'bottom-right\'} />\n' : ''

const layout = `import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import dynamic from 'next/dynamic'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
${toasterImport}
const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })

export const metadata: Metadata = {
  title: 'PromptsFA',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className="bg-[#070503] text-ink antialiased">
        <Header locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
        <PWAControls />
        <RouteLoader />
${toasterUse}      </body>
    </html>
  )
}
`
fs.writeFileSync('src/app/layout.tsx', layout)
console.log('✅ layout rewritten (sonner: ' + (hasSonner ? 'included' : 'skipped') + ')')
NODEEOF

# ---------- 2) header: NotifBell + MobileMenu dynamic (no SSR window crash) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(/import NotifBell from [^\n]+\n?/g, '')
s = s.replace(/import MobileMenu from [^\n]+\n?/g, '')

if (!s.includes("import dynamic from 'next/dynamic'")) {
  s = "import dynamic from 'next/dynamic'\n" + s
}

if (!s.includes('const NotifBell = dynamic')) {
  s = s.replace(
    /export default (async )?function Header/,
    "const NotifBell = dynamic(() => import('@/components/notif-bell'), { ssr: false })\nconst MobileMenu = dynamic(() => import('@/components/mobile-menu'), { ssr: false })\n\nexport default $1function Header"
  )
}

fs.writeFileSync(p, s)
console.log('✅ header: NotifBell + MobileMenu dynamic')
NODEEOF

echo "✅ update89 done!"