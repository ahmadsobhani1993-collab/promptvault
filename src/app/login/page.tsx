import { cookies } from 'next/headers'
import { signIn } from '@/auth'
import WebViewWarning from '@/components/WebViewWarning'
import TelegramLogin from '@/components/TelegramLogin'

export const metadata = { title: 'ورود | PromptsFA' }

export default async function LoginPage() {
  const cookieStore = await cookies()
  const fa = cookieStore.get('locale')?.value !== 'en'

  return (
    <WebViewWarning>
      <section className="container-app grid min-h-[70vh] place-items-center py-16" dir={fa ? 'rtl' : 'ltr'}>
        <div className={'card w-full max-w-md p-8 ' + (fa ? 'text-right' : 'text-left')}>
          <span className="gold-badge">{fa ? 'اعضا' : 'Members'}</span>
          <h1 className="mt-4 font-display text-3xl font-extrabold">{fa ? 'ورود' : 'Sign in'}</h1>
          <p className="mt-3 text-sm leading-7 text-ink-muted">
            {fa ? 'با یکی از روش‌های زیر وارد شوید.' : 'Sign in with one of the following.'}
          </p>

          <div className="mt-6">
            <TelegramLogin
              botUsername="telegramloginbot"
              onAuth={async (user) => {
                const res = await fetch('/api/auth/telegram', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(user),
                })

                if (res.ok) {
                  window.location.href = '/'
                } else {
                  alert(fa ? 'خطا در ورود با تلگرام' : 'Telegram sign in failed')
                }
              }}
            />
          </div>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-sm text-ink-muted">{fa ? 'یا' : 'or'}</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/' })
            }}
          >
            <button type="submit" className="btn-primary w-full justify-center">
              {fa ? 'ورود با گوگل' : 'Continue with Google'}
            </button>
          </form>
        </div>
      </section>
    </WebViewWarning>
  )
}