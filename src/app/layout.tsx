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
