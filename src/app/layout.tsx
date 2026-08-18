import dynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import ScrollProgress from '@/components/scroll-progress'
import MouseTrail from '@/components/mouse-trail'
import type { Locale } from '@/lib/i18n'
const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })
const HeroCanvas = dynamic(() => import('@/components/hero-canvas'), { ssr: false })


const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'),
  title: {
    default: 'PromptsFA — با هوش مصنوعی باهوش کار کن',
    template: '%s | PromptsFA',
  },
  description:
    'پلتفرم کشف، انتشار و اشتراک‌گذاری پرامپت‌های هوش مصنوعی برای تصویر، ویدیو، متن، کد و موسیقی.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <html
      lang={locale}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-screen flex-col bg-base text-ink"
        suppressHydrationWarning
      >
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#d4a94e" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ScrollProgress />
        <MouseTrail />
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
            <PWAControls />
      <RouteLoader />
    </body>
    </html>
  )
}
