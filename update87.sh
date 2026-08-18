#!/bin/bash
set -e

# ---------- 1) layout: همه کامپوننت‌های کلاینتی → dynamic ----------
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import dynamic from 'next/dynamic'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import { Toaster } from '@/components/ui/sonner'

const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })

export const metadata: Metadata = {
  title: 'PromptsFA',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی',
  manifest: '/site.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  themeColor: '#d4a94e',
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
        <Toaster richColors position={locale === 'fa' ? 'bottom-left' : 'bottom-right'} />
      </body>
    </html>
  )
}
EOF
echo "✅ layout rewritten (all client components dynamic)"

# ---------- 2) page.tsx: HeroCanvas dynamic ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// remove static import
s = s.replace(/import HeroCanvas from [^\n]+\n?/g, '')

// ensure dynamic import
if (!s.includes("import dynamic from 'next/dynamic'")) {
  s = "import dynamic from 'next/dynamic'\n" + s
}

// add HeroCanvas declaration
if (!s.includes('const HeroCanvas = dynamic')) {
  s = s.replace(
    "export default async function HomePage()",
    "const HeroCanvas = dynamic(() => import('@/components/hero-canvas'), { ssr: false })\n\nexport default async function HomePage()"
  )
}

fs.writeFileSync(p, s)
console.log('✅ page.tsx: HeroCanvas dynamic')
NODEEOF

# ---------- 3) hero-canvas: window guard ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero-canvas.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('typeof window')) {
  s = s.replace('useEffect(() => {', "useEffect(() => {\n    if (typeof window === 'undefined') return")
  fs.writeFileSync(p, s)
  console.log('✅ hero-canvas: window guard')
}
NODEEOF

# ---------- 4) route-loader: window guard ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/route-loader.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('typeof window')) {
  s = s.replace('useEffect(() => {', "useEffect(() => {\n    if (typeof window === 'undefined') return")
  fs.writeFileSync(p, s)
  console.log('✅ route-loader: window guard')
}
NODEEOF

echo "✅ update87 done!"