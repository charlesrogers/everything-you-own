"use client"

import { useState, useRef, useEffect } from "react"
import { Download, Upload, Trash2, Users, Link2, Copy, ClipboardCheck, X, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useStore } from "@/hooks/use-store"

interface HouseholdMember {
  id: string
  user_id: string
  role: string
  display_name: string | null
  joined_at: string
}

interface HouseholdInvite {
  id: string
  invite_code: string
  created_at: string
  expires_at: string
}

export default function SettingsPage() {
  const store = useStore()
  const { userId } = useAuth()
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [importStatus, setImportStatus] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Household members state
  const [householdName, setHouseholdName] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState("")
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [invites, setInvites] = useState<HouseholdInvite[]>([])
  const [currentUserRole, setCurrentUserRole] = useState("")
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [membersLoading, setMembersLoading] = useState(true)

  useEffect(() => {
    fetch("/api/household")
      .then((r) => r.json())
      .then((data) => {
        setHouseholdName(data.household?.name ?? "")
        setMembers(data.members ?? [])
        setInvites(data.invites ?? [])
        setCurrentUserRole(data.currentUserRole ?? "")
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false))
  }, [])

  async function createInvite() {
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_invite" }),
    })
    const data = await res.json()
    if (data.invite_code) {
      const url = `${window.location.origin}/join/${data.invite_code}`
      navigator.clipboard?.writeText(url)
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 3000)
      // Refresh invites
      const refresh = await fetch("/api/household").then((r) => r.json())
      setInvites(refresh.invites ?? [])
    }
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/household?memberId=${memberId}`, { method: "DELETE" })
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  async function saveName() {
    await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_name", name: editName.trim() }),
    })
    setHouseholdName(editName.trim())
    setEditingName(false)
  }

  async function handleExport() {
    const json = await store.exportAllData()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `everything-you-own-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        await store.importAllData(ev.target?.result as string)
        setImportStatus("Data imported successfully. Refresh the page to see changes.")
      } catch {
        setImportStatus("Import failed. The file may be corrupted.")
      }
    }
    reader.readAsText(file)
  }

  async function handleClear() {
    await store.clearAllData()
    setShowClearDialog(false)
    window.location.reload()
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-[20px] font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Household & Members */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">Household</h2>
          </div>

          {membersLoading ? (
            <p className="text-[12px] text-muted-foreground">Loading...</p>
          ) : (
            <>
              {/* Household name */}
              <div className="flex items-center gap-2">
                {editingName ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border bg-background px-2 py-1 text-[13px] font-medium flex-1"
                      autoFocus
                    />
                    <button onClick={saveName} className="size-6 flex items-center justify-center rounded text-primary hover:bg-accent"><Check className="size-3.5" /></button>
                    <button onClick={() => setEditingName(false)} className="size-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent"><X className="size-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-[14px] font-medium">{householdName}</span>
                    {currentUserRole === "owner" && (
                      <button onClick={() => { setEditName(householdName); setEditingName(true) }} className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"><Pencil className="size-3" /></button>
                    )}
                  </>
                )}
              </div>

              {/* Members list */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-muted-foreground">Members ({members.length})</p>
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-medium text-primary">
                      {(m.display_name ?? m.user_id.slice(0, 2)).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {m.display_name ?? "Member"}
                        {m.user_id === userId && <span className="text-muted-foreground font-normal"> (you)</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{m.role} · joined {new Date(m.joined_at).toLocaleDateString()}</p>
                    </div>
                    {(currentUserRole === "owner" || currentUserRole === "admin") && m.user_id !== userId && m.role !== "owner" && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">Invite someone</p>
                  <Button variant="outline" size="sm" onClick={createInvite}>
                    <Link2 className="size-3.5" />
                    {copiedInvite ? "Copied!" : "Create invite link"}
                  </Button>
                </div>
                {invites.length > 0 && (
                  <div className="space-y-1">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <code className="bg-secondary px-1.5 py-0.5 rounded font-mono">{inv.invite_code}</code>
                        <span>expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(`${window.location.origin}/join/${inv.invite_code}`)
                            setCopiedInvite(true)
                            setTimeout(() => setCopiedInvite(false), 2000)
                          }}
                          className="hover:text-foreground"
                        >
                          {copiedInvite ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Data Management */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-[15px] font-semibold">Data Management</h2>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">Export Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Download all your products and categories as JSON.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-3.5" />
                Export
              </Button>
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">Import Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Restore from a previously exported JSON file.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>

            {importStatus && (
              <p className="text-[12px] text-muted-foreground bg-muted/50 rounded-lg p-2">
                {importStatus}
              </p>
            )}

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-destructive">Clear All Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Remove all products and categories. This cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowClearDialog(true)}>
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <h2 className="text-[15px] font-semibold">About</h2>
          <p className="text-[13px] text-muted-foreground">
            Everything You Own v0.1 — a personal product database for tracking purchases,
            wishlists, and collections. All data is stored locally in your browser.
          </p>
        </div>
      </div>

      {/* Clear Confirmation */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all your products, categories, and settings.
              Consider exporting your data first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Clear Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
