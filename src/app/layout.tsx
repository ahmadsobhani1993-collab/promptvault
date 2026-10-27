import { Vazirmatn } from 'next/font/google'
import type { Metadata } from 'next'
import './globals.css'
import { getCategories } from '@/lib/data'
import HeaderShell from '@/components/layout/header-shell'
import Footer from '@/components/layout/footer'
import Analytics from '@/components/analytics'
import ClientProviders from '@/components/client-providers'
import MouseTrail from '@/components/mouse-trail'

// The lowest revalidate among layout + page wins, so keep this at the highest
// value you want as a default; pages that need fresher data set their own lower value.
export const revalidate = 3600

const vazir = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-vazir',
})

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
  title: 'PromptsFA | هزاران پرامپت حرفه‌ای هوش مصنوعی',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن و استودیو زیرنویس',
  alternates: {
    canonical: 'https://promptsfa.ir',
    languages: { fa: 'https://promptsfa.ir', en: 'https://promptsfa.ir/en' },
  },
}

// Runs before first paint: switches lang/dir/font for /en URLs (layout itself stays static).
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await loadHeaderCategories()

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={vazir.variable}>
      <body suppressHydrationWarning className="bg-[#070503] text-ink antialiased font-sans">
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
        <HeaderShell categories={categories} />
        <main>{children}</main>
        <Footer />
        <Analytics />
        <ClientProviders />
        <MouseTrail />
      </body>
    </html>
  )
}