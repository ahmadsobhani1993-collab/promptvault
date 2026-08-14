import { dictionaries, type Locale } from '@/lib/i18n'

export default function Footer({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]

  return (
    <footer className="border-t border-line/70 bg-elevated/30">
      <div className="container-app py-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-lg font-extrabold">
              Prompts<span className="text-gold-bright">FA</span>
            </p>
            <p dir="ltr" className="mt-1 text-xs text-gold-bright/80 ltr:text-left rtl:text-right">
              promptsfa.ir
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} PromptsFA — {t.footerTagline} {t.rights}
          </p>
        </div>
      </div>
    </footer>
  )
}
