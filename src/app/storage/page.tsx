"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Warehouse, Settings2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"
import type { Location, LocationTreeNode } from "@/lib/wms-types"
import { buildLocationTree } from "@/lib/wms-local-store"
import { LocationTree } from "@/components/location-tree"

export default function StoragePage() {
  const { isLoading: authLoading, householdId } = useAuth()
  const store = useStore()
  const [locations, setLocations] = useState<Location[]>([])
  const [tree, setTree] = useState<LocationTreeNode[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      store.getLocations(),
      store.getItemCountsByLocation(),
    ]).then(([locs, counts]) => {
      setLocations(locs)
      setTree(buildLocationTree(locs))
      setItemCounts(counts)
    }).catch((err) => {
      console.error("Failed to load storage:", err)
    }).finally(() => {
      setLoading(false)
    })
  }, [authLoading, householdId])

  const handleDelete = async (id: string) => {
    await store.deleteLocation(id)
    const [locs, counts] = await Promise.all([
      store.getLocations(),
      store.getItemCountsByLocation(),
    ])
    setLocations(locs)
    setTree(buildLocationTree(locs))
    setItemCounts(counts)
  }

  const totalLocations = locations.length
  const totalItems = Object.values(itemCounts).reduce((sum, c) => sum + c, 0)
  const rooms = locations.filter((l) => l.location_type === "room").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
        Loading storage...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">Storage</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {rooms} room{rooms !== 1 ? "s" : ""} &middot; {totalLocations} locations &middot; {totalItems} items placed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalLocations === 0 && (
            <Link
              href="/storage/setup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Settings2 className="size-3.5" />
              Setup Storage
            </Link>
          )}
          {totalLocations > 0 && (
            <Link
              href="/storage/setup"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="size-3.5" />
              Add Location
            </Link>
          )}
        </div>
      </div>

      {/* Empty state */}
      {totalLocations === 0 && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-12 text-center">
          <Warehouse className="size-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-[15px] font-semibold mb-2">No storage locations yet</h2>
          <p className="text-[13px] text-muted-foreground mb-6 max-w-md mx-auto">
            Set up your storage hierarchy to start tracking where everything lives.
            Start with a room, add racks and shelves, then assign items to bins.
          </p>
          <Link
            href="/storage/setup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Settings2 className="size-3.5" />
            Set Up Basement Storage
          </Link>
        </div>
      )}

      {/* Location Tree */}
      {totalLocations > 0 && (
        <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-[14px] font-semibold">Location Hierarchy</h2>
          </div>
          <div className="p-2">
            <LocationTree tree={tree} itemCounts={itemCounts} onDelete={handleDelete} />
          </div>
        </div>
      )}
    </div>
  )
}
