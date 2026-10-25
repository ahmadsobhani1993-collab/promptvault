import { type Locale } from '@/lib/i18n'
import { auth } from '@/auth'
import MobileHeader from '@/components/mobile-header'
import DesktopHeader from '@/components/desktop-header'

interface HeaderProps {
  locale: Locale
}

export default async function Header({ locale }: HeaderProps) {
  const session = await auth()

  return (
    <>
      <MobileHeader locale={locale} session={session} />
      <DesktopHeader locale={locale} session={session} />
    </>
  )
}
