"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Warehouse, Settings2, Package, Minus, Nfc, Copy, ClipboardCheck, Inbox, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"
import type { Location, LocationTreeNode, CreateLocationInput } from "@/lib/wms-types"
import { SAMLA_BINS } from "@/lib/wms-constants"
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, unknown>[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  // Add bin inline form
  const [showAddBin, setShowAddBin] = useState(false)
  const [addBinShelfId, setAddBinShelfId] = useState("")
  const [addBinName, setAddBinName] = useState("")
  const [addBinTemplate, setAddBinTemplate] = useState("")
  const [addingBin, setAddingBin] = useState(false)

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

  async function reloadData() {
    const res = await fetch("/api/storage")
    const data = await res.json()
    setLocations(data.locations ?? [])
    setTree(buildLocationTree(data.locations ?? []))
    setItemCounts(data.itemCounts ?? {})
  }

  async function handleAddBin(shelfId?: string) {
    const parentId = shelfId || addBinShelfId
    if (!parentId || !addBinName.trim()) return
    setAddingBin(true)
    const template = SAMLA_BINS.find((b) => b.id === addBinTemplate)
    await store.createLocation({
      parent_id: parentId,
      location_type: "compartment",
      unit_subtype: "bin",
      name: addBinName.trim(),
      template_id: addBinTemplate || null,
      width_in: template?.widthIn ?? null,
      depth_in: template?.depthIn ?? null,
      height_in: template?.heightIn ?? null,
    })
    setAddBinName("")
    setAddBinTemplate("")
    setAddBinShelfId("")
    setShowAddBin(false)
    setAddingBin(false)
    await reloadData()
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

  async function toggleExpand(locId: string) {
    if (expandedId === locId) {
      setExpandedId(null)
      setExpandedItems([])
      return
    }
    setExpandedId(locId)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/storage?id=${locId}`)
      const data = await res.json()
      setExpandedItems(data.contents ?? [])
    } catch { setExpandedItems([]) }
    setLoadingItems(false)
  }

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
            <div className="space-y-3">
              {/* Add bin inline form */}
              {showAddBin ? (
                <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 space-y-3">
                  <div className="text-[13px] font-semibold">Add Bin</div>
                  <select
                    value={addBinShelfId}
                    onChange={(e) => setAddBinShelfId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
                  >
                    <option value="">Select a shelf...</option>
                    {shelves.map((s) => (
                      <option key={s.id} value={s.id}>{getParentPath(s)} \u203a {s.name}</option>
                    ))}
                  </select>
                  <select
                    value={addBinTemplate}
                    onChange={(e) => setAddBinTemplate(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
                  >
                    <option value="">Bin type (optional)</option>
                    {SAMLA_BINS.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.widthIn}&quot; &times; {b.depthIn}&quot; &times; {b.heightIn}&quot;)</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={addBinName}
                    onChange={(e) => setAddBinName(e.target.value)}
                    placeholder="Bin name (e.g., Holiday Decorations)"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-[13px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddBin()}
                      disabled={!addBinShelfId || !addBinName.trim() || addingBin}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Plus className="size-3" />
                      {addingBin ? "Adding..." : "Add Bin"}
                    </button>
                    <button
                      onClick={() => setShowAddBin(false)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] font-medium hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddBin(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Plus className="size-3.5" />
                  Add Bin
                </button>
              )}

            <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
              {bins.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">
                  No bins yet. Click &quot;Add Bin&quot; above to create one.
                </div>
              ) : bins.map((bin) => {
                const isExpanded = expandedId === bin.id
                const count = itemCounts[bin.id] ?? 0
                return (
                  <div key={bin.id} className="border-b last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                      <button onClick={() => toggleExpand(bin.id)} className="shrink-0">
                        {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                      </button>
                      <Package className="size-4 text-muted-foreground shrink-0" />
                      <Link href={`/storage/${bin.id}`} className="flex-1 min-w-0 hover:text-primary">
                        <div className="text-[13px] font-medium truncate">{bin.name}</div>
                        <div className="text-[11px] text-muted-foreground">{getParentPath(bin)}</div>
                      </Link>
                      {bin.template_id && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded hidden sm:inline">
                          {bin.template_id.replace("samla_", "").replace("gal", " gal")}
                        </span>
                      )}
                      {count > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                      {bin.nfc_tag_id && <Nfc className="size-3 text-emerald-500" />}
                      <Link
                        href={`/storage/${bin.id}/add`}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium shrink-0"
                      >
                        + Item
                      </Link>
                    </div>
                    {isExpanded && (
                      <div className="bg-accent/20 border-t px-4 py-2">
                        {loadingItems ? (
                          <div className="text-[12px] text-muted-foreground py-2">Loading...</div>
                        ) : expandedItems.length === 0 ? (
                          <div className="text-[12px] text-muted-foreground py-2">
                            Empty — <Link href={`/storage/${bin.id}/add`} className="text-primary">add items</Link>
                          </div>
                        ) : expandedItems.map((item: Record<string, unknown>) => (
                          <div key={String(item.id)} className="flex items-center gap-2 py-1.5">
                            <span className="text-[12px] font-medium flex-1 truncate">{String(item.product_name)}</span>
                            {item.product_brand ? <span className="text-[10px] text-muted-foreground">{String(item.product_brand)}</span> : null}
                            <span className="text-[10px] text-muted-foreground">qty: {String(item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </div>
          )}

          {/* All Shelves tab */}
          {tab === "shelves" && (
            <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
              {shelves.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">
                  No shelves yet. Add shelves to your racks first.
                </div>
              ) : shelves.map((shelf) => {
                const shelfBins = locations.filter((l) => l.parent_id === shelf.id && l.unit_subtype === "bin")
                const binCount = shelfBins.length
                const deepItems = getDeepItemCount(shelf.id)
                const isExpanded = expandedId === shelf.id
                return (
                  <div key={shelf.id} className="border-b last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                      <button onClick={() => { setExpandedId(isExpanded ? null : shelf.id); setExpandedItems([]) }} className="shrink-0">
                        {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                      </button>
                      <Minus className="size-4 text-muted-foreground shrink-0" />
                      <Link href={`/storage/${shelf.id}`} className="flex-1 min-w-0 hover:text-primary">
                        <div className="text-[13px] font-medium truncate">{shelf.name}</div>
                        <div className="text-[11px] text-muted-foreground">{getParentPath(shelf)}</div>
                      </Link>
                      {binCount > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {binCount} bins
                        </span>
                      )}
                      {deepItems > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                          {deepItems}
                        </span>
                      )}
                      <Link
                        href={`/storage/${shelf.id}`}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium shrink-0"
                      >
                        + Bin
                      </Link>
                    </div>
                    {isExpanded && (
                      <div className="bg-accent/20 border-t">
                        {shelfBins.map((bin) => {
                          const binItems = itemCounts[bin.id] ?? 0
                          return (
                            <div key={bin.id} className="flex items-center gap-2 px-4 py-2 border-b border-accent/30">
                              <Package className="size-3 text-muted-foreground shrink-0" />
                              <Link href={`/storage/${bin.id}`} className="text-[12px] font-medium flex-1 truncate hover:text-primary">
                                {bin.name}
                              </Link>
                              {bin.template_id && (
                                <span className="text-[9px] text-muted-foreground bg-secondary/80 px-1 py-0.5 rounded">
                                  {bin.template_id.replace("samla_", "").replace("gal", "g")}
                                </span>
                              )}
                              {binItems > 0 && (
                                <span className="text-[10px] text-muted-foreground">{binItems} items</span>
                              )}
                              {bin.nfc_tag_id && <Nfc className="size-2.5 text-emerald-500" />}
                              <Link href={`/storage/${bin.id}/add`} className="text-[10px] text-primary font-medium">+ Item</Link>
                            </div>
                          )
                        })}
                        {/* Quick add bin row */}
                        {addBinShelfId === shelf.id ? (
                          <div className="flex items-center gap-2 px-4 py-2">
                            <select
                              value={addBinTemplate}
                              onChange={(e) => setAddBinTemplate(e.target.value)}
                              className="rounded border bg-background px-2 py-1 text-[11px] w-28"
                            >
                              <option value="">Type</option>
                              {SAMLA_BINS.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={addBinName}
                              onChange={(e) => setAddBinName(e.target.value)}
                              placeholder="Bin name..."
                              className="flex-1 rounded border bg-background px-2 py-1 text-[12px]"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && handleAddBin(shelf.id)}
                            />
                            <button
                              onClick={() => handleAddBin(shelf.id)}
                              disabled={!addBinName.trim() || addingBin}
                              className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                            >
                              {addingBin ? "..." : "Add"}
                            </button>
                            <button
                              onClick={() => { setAddBinShelfId(""); setAddBinName(""); setAddBinTemplate("") }}
                              className="text-[11px] text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddBinShelfId(shelf.id)}
                            className="flex items-center gap-1 px-4 py-2 text-[11px] text-primary font-medium hover:bg-accent/30 w-full"
                          >
                            <Plus className="size-3" /> Add bin to {shelf.name}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
