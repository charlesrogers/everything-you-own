"use client"

import Link from "next/link"

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-[20px] font-bold">Something went wrong</h1>
      <p className="mt-2 text-[13px] text-muted-foreground max-w-sm">
        An unexpected error occurred. Try again or go back to the dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
