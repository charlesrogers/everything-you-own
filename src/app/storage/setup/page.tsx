"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Warehouse, ChevronRight, Check } from "lucide-react"
import { useStore } from "@/hooks/use-store"
import type { LocationType } from "@/lib/wms-types"
import { LOCATION_TYPE_CONFIG } from "@/lib/wms-constants"

type SetupMode = "choose" | "basement" | "custom"

export default function StorageSetupPage() {
  const router = useRouter()
  const store = useStore()
  const [mode, setMode] = useState<SetupMode>("choose")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Custom room form
  const [roomName, setRoomName] = useState("")
  const [locationType, setLocationType] = useState<LocationType>("room")

  const handleSeedBasement = async () => {
    setLoading(true)
    try {
      await store.seedBasementStorage()
      setSuccess(true)
      setTimeout(() => router.push("/storage"), 1500)
    } catch (err) {
      console.error("Failed to seed basement:", err)
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return
    setLoading(true)
    try {
      const loc = await store.createLocation({
        parent_id: null,
        location_type: locationType,
        name: roomName.trim(),
      })
      router.push(`/storage/${loc.id}`)
    } catch (err) {
      console.error("Failed to create location:", err)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="size-8 text-emerald-500" />
        </div>
        <h2 className="text-[15px] font-semibold">Basement Storage Created</h2>
        <p className="text-[13px] text-muted-foreground">
          4 OMAR racks with 6 shelves each — 24 shelf locations ready to go.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-[20px] font-bold">Set Up Storage</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Create your storage hierarchy to start tracking where everything lives.
        </p>
      </div>

      {mode === "choose" && (
        <div className="space-y-3">
          <button
            onClick={() => setMode("basement")}
            className="w-full rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-5 text-left hover:shadow-md hover:shadow-black/[0.06] transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Warehouse className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold">Basement Storage Room</h3>
                <p className="text-[12px] text-muted-foreground">
                  4 IKEA OMAR racks &times; 6 shelves = 24 shelf locations, pre-configured
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </button>

          <button
            onClick={() => setMode("custom")}
            className="w-full rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-5 text-left hover:shadow-md hover:shadow-black/[0.06] transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
                <Plus className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold">Custom Location</h3>
                <p className="text-[12px] text-muted-foreground">
                  Create a room, zone, or any custom storage location
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </button>
        </div>
      )}

      {mode === "basement" && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-6 space-y-4">
          <h2 className="text-[15px] font-semibold">Basement Storage Room</h2>
          <p className="text-[13px] text-muted-foreground">
            This will create:
          </p>
          <ul className="text-[13px] space-y-1.5 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span><strong>Basement Storage Room</strong> (room)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span><strong>4 OMAR Racks</strong> (36.25&quot; &times; 14&quot; &times; 72&quot;)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span><strong>24 Shelves</strong> (6 per rack, 11.5&quot; height each)</span>
            </li>
          </ul>
          <p className="text-[12px] text-muted-foreground">
            You can add zones, bins, and drawers afterwards.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSeedBasement}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Basement Storage"}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {mode === "custom" && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-6 space-y-4">
          <h2 className="text-[15px] font-semibold">Create Location</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
                Type
              </label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
              >
                {Object.entries(LOCATION_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
                Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g., Kitchen, Garage, Master Closet"
                className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreateRoom}
              disabled={loading || !roomName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
