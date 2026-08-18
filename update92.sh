#!/bin/bash
set -e

# ---------- 1) client-providers.tsx (Client Component) ----------
cat > src/components/client-providers.tsx << 'EOF'
'use client'

import dynamic from 'next/dynamic'

const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })

export default function ClientProviders() {
  return (
    <>
      <PWAControls />
      <RouteLoader />
    </>
  )
}
EOF
echo "✅ client-providers.tsx created"

# ---------- 2) layout.tsx: import ClientProviders ----------
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import ClientProviders from '@/components/client-providers'

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
        <ClientProviders />
      </body>
    </html>
  )
}
EOF
echo "✅ layout.tsx: simplified (uses ClientProviders)"

echo "✅ update92 done!"