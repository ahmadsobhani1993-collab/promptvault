import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import JsonLd from '@/components/json-ld'
import Analytics from '@/components/analytics'
import RouteLoader from '@/components/route-loader'
import PWAControls from '@/components/pwa-controls'
import ClientProviders from '@/components/client-providers'
import MouseTrail from '@/components/mouse-trail'

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
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
        <Analytics />
        <PWAControls />
        <ClientProviders />
        <MouseTrail />
      </body>
    </html>
  )
}
