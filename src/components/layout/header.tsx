import { type Locale } from '@/lib/i18n'
import MobileHeader from '@/components/mobile-header'
import DesktopHeader from '@/components/desktop-header'

interface HeaderProps {
  locale: Locale
}

export default function Header({ locale }: HeaderProps) {
  return (
    <>
      <MobileHeader locale={locale} />
      <DesktopHeader locale={locale} />
    </>
  )
}
