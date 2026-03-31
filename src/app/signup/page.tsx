"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}

function SignUpForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function signUpWithGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
  }

  async function signUpWithEmail() {
    if (!email || !password) return
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
    setLoading(false)

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("An account with this email already exists. Try signing in instead.")
      } else {
        setError(signUpError.message)
      }
      return
    }

    // If email confirmation is required, Supabase returns a user but no session
    if (data.user && !data.session) {
      setSuccess(true)
    } else {
      window.location.href = redirect
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-[20px] font-bold">Check your email</h1>
          <p className="text-[13px] text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="inline-block text-[13px] text-primary hover:underline font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-[20px] font-bold">Create your account</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Start tracking everything you own
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={signUpWithGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-[13px] font-medium shadow-sm shadow-black/[0.04] transition-all hover:shadow-md hover:shadow-black/[0.06] active:translate-y-px"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-[13px] text-destructive">
              {error}
              {error.includes("already exists") && (
                <Link href="/login" className="ml-1 underline font-medium">
                  Sign in
                </Link>
              )}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              placeholder="Email address"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="Password"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError("") }}
              placeholder="Confirm password"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onKeyDown={(e) => e.key === "Enter" && signUpWithEmail()}
            />
            <button
              onClick={signUpWithEmail}
              disabled={!email || !password || !confirmPassword || loading}
              className="w-full rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all hover:bg-primary/90 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
