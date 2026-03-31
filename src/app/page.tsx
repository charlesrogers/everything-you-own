"use client"

import Link from "next/link"
import { Mail, Warehouse, Users, ArrowRight, Package } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

const features = [
  {
    icon: Mail,
    title: "Gmail Receipt Import",
    description: "Connect your Gmail and auto-import purchases from order confirmation emails. AI extracts product names, prices, and retailers.",
  },
  {
    icon: Warehouse,
    title: "Storage & NFC Tracking",
    description: "Map your home room by room — racks, shelves, bins. Stick an NFC tag on a bin and scan it to instantly see what's inside.",
  },
  {
    icon: Users,
    title: "Household Sharing",
    description: "Invite your family or roommates. Everyone sees the shared inventory so nobody buys duplicates.",
  },
]

export default function LandingPage() {
  const { user, isLoading } = useAuth()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-primary" />
          <span className="text-[15px] font-semibold">Everything You Own</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-3xl mx-auto">
        <h1 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight">
          Know what you own,<br />where it is, and what it&apos;s worth
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground max-w-lg leading-relaxed">
          A personal home inventory that builds itself from your email receipts. Tag bins with NFC, share with your household, and never lose track of your stuff again.
        </p>
        <div className="mt-8 flex gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px shadow-sm"
            >
              Go to Dashboard
              <ArrowRight className="size-4" />
            </Link>
          ) : !isLoading ? (
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px shadow-sm"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 shadow-sm shadow-black/[0.04] hover:shadow-md hover:shadow-black/[0.06] transition-shadow"
            >
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="text-[14px] font-semibold mb-2">{f.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center">
        <p className="text-[12px] text-muted-foreground">
          Everything You Own — a personal home inventory tracker
        </p>
      </footer>
    </div>
  )
}
