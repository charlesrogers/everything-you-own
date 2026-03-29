"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { Users, Check, X } from "lucide-react"
import Link from "next/link"

export default function JoinHouseholdPage() {
  const params = useParams()
  const router = useRouter()
  const { user, householdId } = useAuth()
  const code = params.code as string

  const [status, setStatus] = useState<"loading" | "confirm" | "joining" | "success" | "error" | "already">("loading")
  const [householdName, setHouseholdName] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!user) return

    async function checkInvite() {
      const sb = createClient()

      // Look up the invite
      const { data: invite, error } = await sb
        .from("household_invites")
        .select("id, household_id, expires_at, used_by, households(name)")
        .eq("invite_code", code)
        .single()

      if (error || !invite) {
        setErrorMsg("Invalid or expired invite link.")
        setStatus("error")
        return
      }

      if (invite.used_by) {
        setErrorMsg("This invite has already been used.")
        setStatus("error")
        return
      }

      if (new Date(invite.expires_at) < new Date()) {
        setErrorMsg("This invite has expired.")
        setStatus("error")
        return
      }

      const h = invite.households as unknown as Record<string, unknown> | null
      setHouseholdName((h?.name as string) ?? "Unknown")

      // Check if already a member
      if (householdId === invite.household_id) {
        setStatus("already")
        return
      }

      setStatus("confirm")
    }

    checkInvite()
  }, [user, code, householdId])

  async function handleJoin() {
    setStatus("joining")
    try {
      const sb = createClient()

      // Get invite details
      const { data: invite } = await sb
        .from("household_invites")
        .select("id, household_id")
        .eq("invite_code", code)
        .single()

      if (!invite) {
        setErrorMsg("Invite not found.")
        setStatus("error")
        return
      }

      // Add user to household
      const { error: joinErr } = await sb
        .from("household_members")
        .insert({
          household_id: invite.household_id,
          user_id: user!.id,
          role: "member",
          display_name: user!.email?.split("@")[0] ?? null,
        })

      if (joinErr) {
        if (joinErr.code === "23505") {
          setStatus("already")
          return
        }
        setErrorMsg(joinErr.message)
        setStatus("error")
        return
      }

      // Mark invite as used
      await sb
        .from("household_invites")
        .update({ used_by: user!.id, used_at: new Date().toISOString() })
        .eq("id", invite.id)

      setStatus("success")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to join")
      setStatus("error")
    }
  }

  if (!user) {
    return (
      <div className="max-w-sm mx-auto mt-24 text-center space-y-4">
        <Users className="size-12 text-muted-foreground/30 mx-auto" />
        <h1 className="text-[20px] font-bold">Join Household</h1>
        <p className="text-[13px] text-muted-foreground">You need to sign in first.</p>
        <Link href={`/login?redirect=/join/${code}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto mt-24 text-center space-y-4">
      <Users className="size-12 text-muted-foreground/30 mx-auto" />
      <h1 className="text-[20px] font-bold">Join Household</h1>

      {status === "loading" && <p className="text-[13px] text-muted-foreground">Checking invite...</p>}

      {status === "confirm" && (
        <>
          <p className="text-[13px] text-muted-foreground">
            You&apos;ve been invited to join <strong className="text-foreground">{householdName}</strong>.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleJoin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Check className="size-3.5" />
              Join
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent"
            >
              <X className="size-3.5" />
              Cancel
            </button>
          </div>
        </>
      )}

      {status === "joining" && <p className="text-[13px] text-muted-foreground">Joining...</p>}

      {status === "success" && (
        <>
          <p className="text-[13px] text-emerald-600">You&apos;ve joined <strong>{householdName}</strong>!</p>
          <p className="text-[12px] text-muted-foreground">Refresh the page to see shared items.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
            Go to Dashboard
          </Link>
        </>
      )}

      {status === "already" && (
        <>
          <p className="text-[13px] text-muted-foreground">You&apos;re already a member of <strong className="text-foreground">{householdName}</strong>.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
            Go to Dashboard
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <p className="text-[13px] text-destructive">{errorMsg}</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent">
            Go to Dashboard
          </Link>
        </>
      )}
    </div>
  )
}
