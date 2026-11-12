import 'vazirmatn/misc/Farsi-Digits/Vazirmatn-FD-font-face.css';
import { Suspense } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { getCategories } from '@/lib/data'
import HeaderShell from '@/components/layout/header-shell'
import Footer from '@/components/layout/footer'
import Analytics from '@/components/analytics'
import ClientProviders from '@/components/client-providers'
import MouseTrail from '@/components/mouse-trail'
import LocaleDocument from '@/components/locale-document'
import HomeCosmosBackground from '@/components/home-cosmos-background'

export const revalidate = 86400

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
  title: 'PromptsFA | هزاران پرامپت حرفه‌ای هوش مصنوعی',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن و استودیو زیرنویس',
}

const localeScript = `(function(){try{var p=location.pathname;if(p==='/en'||p.indexOf('/en/')===0){var h=document.documentElement;h.lang='en';h.dir='ltr';document.body.classList.remove('font-sans')}}catch(e){}})();`

async function loadHeaderCategories() {
  try {
    const cats = await getCategories()
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      icon: c.icon,
      nameFa: c.nameFa,
      nameEn: c.nameEn,
    }))
  } catch {
    return []
  }
}

async function HeaderWithCategories() {
  const categories = await loadHeaderCategories()
  return <HeaderShell categories={categories} />
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning className="relative isolate min-h-screen bg-[#070709] text-ink antialiased font-sans">
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
        <LocaleDocument />
        <div className="pointer-events-none fixed inset-0 z-0">
          <HomeCosmosBackground />
        </div>
        <div className="relative z-10 flex min-h-screen flex-col">
          <Suspense fallback={<HeaderShell categories={[]} />}>
            <HeaderWithCategories />
          </Suspense>
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <Analytics />
        <ClientProviders />
        <MouseTrail />
      </body>
    </html>
  )
}