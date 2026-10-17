import { Vazirmatn } from 'next/font/google'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Analytics from '@/components/analytics'
import PWAControls from '@/components/pwa-controls'
import ClientProviders from '@/components/client-providers'
import MouseTrail from '@/components/mouse-trail'

const vazir = Vazirmatn({ 
  subsets: ['arabic', 'latin'], 
  display: 'swap', 
  variable: '--font-vazir' 
})

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') as Locale) || 'fa'

  return {
    icons: { icon: '/favicon.svg', apple: '/icon.svg' },
    title: locale === 'fa' ? 'PromptsFA | هزاران پرامپت حرفه‌ای هوش مصنوعی' : 'PromptsFA | AI Prompts Directory',
    description: locale === 'fa' 
      ? 'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن و استودیو زیرنویس' 
      : 'Discover thousands of curated AI prompts and video caption studio',
    alternates: {
      canonical: 'https://promptsfa.ir',
      languages: { fa: 'https://promptsfa.ir', en: 'https://promptsfa.ir/en' },
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const cookieStore = await cookies()

  const headerLocale = headersList.get('x-locale') as Locale | null
  const cookieLocale = cookieStore.get('locale')?.value as Locale | undefined
  const locale: Locale = headerLocale || (cookieLocale === 'en' ? 'en' : 'fa')

  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} suppressHydrationWarning className={vazir.variable}>
      <body suppressHydrationWarning className={`bg-[#070503] text-ink antialiased ${locale === 'fa' ? 'font-sans' : ''}`}>
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
