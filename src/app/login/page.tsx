import { cookies } from 'next/headers'
import { signIn } from '@/auth'

export const metadata = { title: 'ورود | PromptsFA' }

export default async function LoginPage() {
  const cookieStore = await cookies()
  const fa = cookieStore.get('locale')?.value !== 'en'

  return (
    <section className="container-app grid min-h-[70vh] place-items-center py-16" dir={fa ? 'rtl' : 'ltr'}>
      <div className={'card w-full max-w-md p-8 ' + (fa ? 'text-right' : 'text-left')}>
        <span className="gold-badge">{fa ? 'اعضا' : 'Members'}</span>
        <h1 className="mt-4 font-display text-3xl font-extrabold">{fa ? 'ورود' : 'Sign in'}</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {fa ? 'برای ادامه از حساب گوگل خود استفاده کنید.' : 'Use your Google account to continue.'}
        </p>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/' })
          }}
          className="mt-6"
        >
          <button type="submit" className="btn-primary w-full justify-center">Continue with Google</button>
        </form>
      </div>
    </section>
  )
}
