"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Warehouse, Settings2, Package, Minus, Nfc, Copy, ClipboardCheck, Inbox } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"
import type { Location, LocationTreeNode } from "@/lib/wms-types"
import { buildLocationTree } from "@/lib/wms-local-store"
import { LocationTree } from "@/components/location-tree"

type Tab = "tree" | "bins" | "shelves" | "tag"

export default function StoragePage() {
  const { isLoading: authLoading, householdId } = useAuth()
  const store = useStore()
  const [locations, setLocations] = useState<Location[]>([])
  const [tree, setTree] = useState<LocationTreeNode[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("tree")
  const [tagFilter, setTagFilter] = useState<"all" | "untagged" | "tagged">("untagged")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    fetch("/api/storage")
      .then((r) => r.json())
      .then((data) => {
        setLocations(data.locations ?? [])
        setTree(buildLocationTree(data.locations ?? []))
        setItemCounts(data.itemCounts ?? {})
      })
      .catch((err) => console.error("Failed to load storage:", err))
      .finally(() => setLoading(false))
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

  // Build location map for parent paths
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations])

  function getParentPath(loc: Location): string {
    const parts: string[] = []
    let cur = loc.parent_id ? locMap.get(loc.parent_id) : undefined
    while (cur) {
      parts.unshift(cur.label ?? cur.name)
      cur = cur.parent_id ? locMap.get(cur.parent_id) : undefined
    }
    return parts.join(" \u203a ")
  }

  // Filtered lists
  const bins = useMemo(() =>
    locations.filter((l) => l.unit_subtype === "bin").sort((a, b) => a.name.localeCompare(b.name)),
    [locations]
  )
  const shelves = useMemo(() =>
    locations.filter((l) => l.unit_subtype === "shelf" || l.unit_subtype === "drawer").sort((a, b) => {
      const pa = getParentPath(a)
      const pb = getParentPath(b)
      return pa.localeCompare(pb) || a.sort_order - b.sort_order
    }),
    [locations]
  )

  const taggedBins = bins.filter((b) => b.nfc_tag_id)
  const untaggedBins = bins.filter((b) => !b.nfc_tag_id)
  const tagProgress = bins.length > 0 ? Math.round((taggedBins.length / bins.length) * 100) : 0

  const filteredTagBins = tagFilter === "untagged" ? untaggedBins : tagFilter === "tagged" ? taggedBins : bins

  function copyNfcUrl(loc: Location) {
    if (!loc.short_id) return
    navigator.clipboard.writeText(`https://stuff.imprevista.com/s/${loc.short_id}`)
    setCopiedId(loc.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function getBinCount(shelfId: string): number {
    return locations.filter((l) => l.parent_id === shelfId && l.unit_subtype === "bin").length
  }

  function getDeepItemCount(locId: string): number {
    let total = itemCounts[locId] ?? 0
    for (const child of locations.filter((l) => l.parent_id === locId)) {
      total += getDeepItemCount(child.id)
    }
    return total
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
            {bins.length > 0 && <> &middot; {taggedBins.length}/{bins.length} bins tagged</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalLocations === 0 ? (
            <Link
              href="/storage/setup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Settings2 className="size-3.5" />
              Setup Storage
            </Link>
          ) : (
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

      {/* Tabs */}
      {totalLocations > 0 && (
        <>
          <div className="flex gap-1 border-b">
            {([
              { id: "tree" as Tab, label: "Tree" },
              { id: "bins" as Tab, label: `Bins (${bins.length})` },
              { id: "shelves" as Tab, label: `Shelves (${shelves.length})` },
              { id: "tag" as Tab, label: `Tag Bins` },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tree tab */}
          {tab === "tree" && (
            <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
              <div className="p-2">
                <LocationTree tree={tree} itemCounts={itemCounts} onDelete={handleDelete} />
              </div>
            </div>
          )}

          {/* All Bins tab */}
          {tab === "bins" && (
            <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
              {bins.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">
                  No bins yet. Add bins to your shelves first.
                </div>
              ) : bins.map((bin) => (
                <Link
                  key={bin.id}
                  href={`/storage/${bin.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <Package className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{bin.name}</div>
                    <div className="text-[11px] text-muted-foreground">{getParentPath(bin)}</div>
                  </div>
                  {bin.template_id && (
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded hidden sm:inline">
                      {bin.template_id.replace("samla_", "").replace("gal", " gal")}
                    </span>
                  )}
                  {(itemCounts[bin.id] ?? 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                      {itemCounts[bin.id]} items
                    </span>
                  )}
                  {bin.nfc_tag_id && (
                    <Nfc className="size-3 text-emerald-500" />
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* All Shelves tab */}
          {tab === "shelves" && (
            <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
              {shelves.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">
                  No shelves yet. Add shelves to your racks first.
                </div>
              ) : shelves.map((shelf) => {
                const binCount = getBinCount(shelf.id)
                const deepItems = getDeepItemCount(shelf.id)
                return (
                  <Link
                    key={shelf.id}
                    href={`/storage/${shelf.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <Minus className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{shelf.name}</div>
                      <div className="text-[11px] text-muted-foreground">{getParentPath(shelf)}</div>
                    </div>
                    {binCount > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {binCount} bins
                      </span>
                    )}
                    {deepItems > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                        {deepItems} items
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Tag Bins tab */}
          {tab === "tag" && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium">
                    {taggedBins.length} of {bins.length} bins tagged
                  </span>
                  <span className="text-[12px] text-muted-foreground">{tagProgress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${tagProgress}%` }}
                  />
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-1">
                {([
                  { id: "untagged" as const, label: `Untagged (${untaggedBins.length})` },
                  { id: "all" as const, label: `All (${bins.length})` },
                  { id: "tagged" as const, label: `Tagged (${taggedBins.length})` },
                ]).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTagFilter(f.id)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      tagFilter === f.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Bin list */}
              <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
                {filteredTagBins.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-muted-foreground">
                    {tagFilter === "untagged" ? "All bins are tagged!" : "No bins match this filter."}
                  </div>
                ) : filteredTagBins.map((bin) => {
                  const isCopied = copiedId === bin.id
                  const isTagged = !!bin.nfc_tag_id
                  return (
                    <div
                      key={bin.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Package className={`size-4 shrink-0 ${isTagged ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <Link
                        href={`/storage/${bin.id}`}
                        className="flex-1 min-w-0 hover:text-primary transition-colors"
                      >
                        <div className="text-[13px] font-medium truncate">{bin.name}</div>
                        <div className="text-[11px] text-muted-foreground">{getParentPath(bin)}</div>
                      </Link>
                      {bin.short_id && (
                        <button
                          onClick={() => copyNfcUrl(bin)}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
                            isCopied
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                              : "bg-secondary border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                        >
                          {isCopied ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                          {isCopied ? "Copied!" : "Copy URL"}
                        </button>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-1 rounded-full shrink-0 ${
                        isTagged
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isTagged ? "Tagged" : "Not tagged"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
