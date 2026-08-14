import type { Metadata } from 'next'
import { signIn } from '@/auth'

export const metadata: Metadata = { title: 'Login' }

export default function LoginPage() {
  async function signInWithGoogle() {
    'use server'
    await signIn('google', { redirectTo: '/' })
  }

  return (
    <section className="container-app flex min-h-[70vh] items-center justify-center py-16">
      <div className="card w-full max-w-md animate-slide-up p-8">
        <p className="gold-badge">Members</p>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">Use your Google account to continue.</p>
        <form action={signInWithGoogle} className="mt-8">
          <button type="submit" className="btn-primary h-12 w-full">Continue with Google</button>
        </form>
      </div>
    </section>
  )
}
