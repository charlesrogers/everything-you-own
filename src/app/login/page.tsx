'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const error = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  async function signInWithGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
  }

  async function signInWithPassword() {
    if (!email || !password) return
    setLoading(true)
    setLoginError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setLoginError(signInError.message)
    } else {
      window.location.href = redirect
    }
  }

  async function signInWithMagicLink() {
    if (!email) return
    setLoading(true)
    const supabase = createClient()
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
    setLoading(false)
    if (!magicError) {
      setMagicLinkSent(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-[20px] font-bold">Welcome</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sign in to Everything You Own
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-[13px] text-destructive">
            Authentication failed. Please try again.
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-[13px] font-medium shadow-sm shadow-black/[0.04] transition-all hover:shadow-md hover:shadow-black/[0.06] active:translate-y-px"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {loginError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-[13px] text-destructive">
              {loginError}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError('') }}
              placeholder="Email address"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
              placeholder="Password"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onKeyDown={(e) => e.key === 'Enter' && signInWithPassword()}
            />
            <button
              onClick={signInWithPassword}
              disabled={!email || !password || loading}
              className="w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all hover:bg-primary/90 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
