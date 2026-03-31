"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, GitMerge, Check, Trash2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/hooks/use-store"
import { useAuth } from "@/components/auth-provider"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import type { Product } from "@/lib/types"

interface DupeGroup {
  reason: string
  products: Product[]
  deleteIds: Set<string>
  isFalsePositive: boolean
  keepQty: number // quantity to set on the kept product
}

function normalizeForComparison(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

function findDuplicateGroups(
  products: Product[],
  placedProductIds: Set<string>
): DupeGroup[] {
  const assigned = new Set<string>()
  const groups: DupeGroup[] = []

  function addGroup(reason: string, prods: Product[], isFalsePositive: boolean) {
    const ids = prods.map((p) => p.id)
    if (ids.some((id) => assigned.has(id))) return
    ids.forEach((id) => assigned.add(id))

    // Sort: prefer keeping products with locations, then oldest
    const sorted = [...prods].sort((a, b) => {
      const aPlaced = placedProductIds.has(a.id) ? 1 : 0
      const bPlaced = placedProductIds.has(b.id) ? 1 : 0
      if (bPlaced !== aPlaced) return bPlaced - aPlaced // placed first
      return a.created_at.localeCompare(b.created_at) // then oldest
    })

    // Default: keep first (placed or oldest), mark rest for deletion
    const deleteIds = isFalsePositive
      ? new Set<string>() // don't auto-select any for deletion on false positives
      : new Set(sorted.slice(1).map((p) => p.id))

    // Default qty = 1 (user can change it)
    groups.push({ reason, products: sorted, deleteIds, isFalsePositive, keepQty: 1 })
  }

  // Pass 1: Exact name match — but check if different orders (= false positive)
  const byNormalizedName = new Map<string, Product[]>()
  for (const p of products) {
    const key = normalizeForComparison(p.name)
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, [])
    byNormalizedName.get(key)!.push(p)
  }
  for (const [, prods] of byNormalizedName) {
    if (prods.length < 2) continue
    // Check if these are from different orders — likely bought the same thing twice
    const orderIds = new Set(prods.map((p) => (p.order_id || "").toLowerCase().trim()).filter(Boolean))
    const isFalsePositive = orderIds.size > 1
    addGroup(
      isFalsePositive ? "Same name but different orders (likely separate purchases)" : "Exact name match",
      prods,
      isFalsePositive
    )
  }

  // Pass 2: Same order_id + retailer with similar names
  const byOrder = new Map<string, Product[]>()
  for (const p of products) {
    if (assigned.has(p.id) || !p.order_id || !p.retailer) continue
    const key = `${p.order_id.trim().toLowerCase()}|${p.retailer.trim().toLowerCase()}`
    if (!byOrder.has(key)) byOrder.set(key, [])
    byOrder.get(key)!.push(p)
  }
  for (const [, prods] of byOrder) {
    if (prods.length < 2) continue
    const nameGroups = new Map<string, Product[]>()
    for (const p of prods) {
      const norm = normalizeForComparison(p.name)
      let found = false
      for (const [existingName, group] of nameGroups) {
        if (norm === existingName || norm.includes(existingName) || existingName.includes(norm)) {
          group.push(p)
          found = true
          break
        }
      }
      if (!found) nameGroups.set(norm, [p])
    }
    for (const [, nameGroup] of nameGroups) {
      if (nameGroup.length < 2) continue
      // Same order + similar name BUT different prices = probably different variants, not dupes
      const prices = new Set(nameGroup.map((p) => p.price).filter((p) => p != null))
      const isFalsePositive = prices.size > 1
      addGroup(
        isFalsePositive ? "Same order, similar name, different prices (variants?)" : "Same order + similar name",
        nameGroup,
        isFalsePositive
      )
    }
  }

  // Pass 3: Same name + price + retailer
  const byNamePriceRetailer = new Map<string, Product[]>()
  for (const p of products) {
    if (assigned.has(p.id) || !p.retailer || p.price == null) continue
    const key = `${normalizeForComparison(p.name)}|${p.price}|${p.retailer.trim().toLowerCase()}`
    if (!byNamePriceRetailer.has(key)) byNamePriceRetailer.set(key, [])
    byNamePriceRetailer.get(key)!.push(p)
  }
  for (const [, prods] of byNamePriceRetailer) {
    if (prods.length < 2) continue
    addGroup("Same name + price + retailer", prods, false)
  }

  // Pass 4: Fuzzy substring match
  const remaining = products.filter((p) => !assigned.has(p.id))
  for (let i = 0; i < remaining.length; i++) {
    if (assigned.has(remaining[i].id)) continue
    const normA = normalizeForComparison(remaining[i].name)
    const fuzzyGroup: Product[] = [remaining[i]]
    for (let j = i + 1; j < remaining.length; j++) {
      if (assigned.has(remaining[j].id)) continue
      const normB = normalizeForComparison(remaining[j].name)
      const shorter = normA.length <= normB.length ? normA : normB
      const longer = normA.length <= normB.length ? normB : normA
      if (longer.includes(shorter) && shorter.length > 3 && shorter.length / longer.length > 0.6) {
        fuzzyGroup.push(remaining[j])
      }
    }
    if (fuzzyGroup.length >= 2) {
      // Fuzzy matches with different orders or different prices are likely false positives
      const orderIds = new Set(fuzzyGroup.map((p) => (p.order_id || "").toLowerCase().trim()).filter(Boolean))
      const prices = new Set(fuzzyGroup.map((p) => p.price).filter((p) => p != null))
      const isFalsePositive = orderIds.size > 1 || prices.size > 1
      addGroup(
        isFalsePositive ? "Similar name but different orders/prices" : "Similar name (fuzzy)",
        fuzzyGroup,
        isFalsePositive
      )
    }
  }

  // Sort: true duplicates first, false positives at bottom
  return groups.sort((a, b) => {
    if (a.isFalsePositive !== b.isFalsePositive) return a.isFalsePositive ? 1 : -1
    return b.products.length - a.products.length // larger groups first
  })
}

export default function DedupePage() {
  const store = useStore()
  useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [placedProductIds, setPlacedProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<DupeGroup[]>([])
  const [merging, setMerging] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [showFalsePositives, setShowFalsePositives] = useState(false)

  useEffect(() => {
    async function load() {
      const [all, storageData] = await Promise.all([
        store.getProducts(),
        fetch("/api/storage").then((r) => r.json()).catch(() => ({ locations: [], itemCounts: {} })),
      ])

      // Get product IDs that have storage locations
      const placed = new Set<string>()
      try {
        // Fetch product_locations to build the set of placed product IDs
        const unsorted = await store.getUnsortedProducts()
        const unsortedIds = new Set(unsorted.map((u: { id: string }) => u.id))
        for (const p of all) {
          if (!unsortedIds.has(p.id)) placed.add(p.id)
        }
      } catch {
        // If unsorted endpoint fails, just continue without placement info
      }

      setProducts(all)
      setPlacedProductIds(placed)
      setGroups(findDuplicateGroups(all, placed))
      setLoading(false)
    }
    load()
  }, [store])

  const trueDupes = useMemo(() => groups.filter((g) => !g.isFalsePositive), [groups])
  const falsePositives = useMemo(() => groups.filter((g) => g.isFalsePositive), [groups])

  const totalMarkedForDeletion = useMemo(
    () => trueDupes.reduce((sum, g) => sum + g.deleteIds.size, 0),
    [trueDupes]
  )

  const toggleDelete = (groupIdx: number, productId: string) => {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g
        const next = new Set(g.deleteIds)
        if (next.has(productId)) {
          next.delete(productId)
        } else {
          if (next.size >= g.products.length - 1) return g // keep at least one
          next.add(productId)
        }
        return { ...g, deleteIds: next }
      })
    )
  }

  const updateKeepQty = (groupIdx: number, qty: number) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, keepQty: Math.max(1, qty) } : g))
    )
  }

  const mergeGroup = async (groupIdx: number) => {
    setMerging(true)
    const group = groups[groupIdx]
    const toDelete = group.products.filter((p) => group.deleteIds.has(p.id))
    const kept = group.products.find((p) => !group.deleteIds.has(p.id))

    // Set quantity on kept product's location if qty > 1
    if (kept && group.keepQty > 1) {
      try {
        const locations = await store.getProductLocations(kept.id)
        if (locations.length > 0) {
          await store.updateProductLocation(locations[0].id, { quantity: group.keepQty })
        }
      } catch (e) {
        console.error("Failed to set qty:", e)
      }
    }

    for (const p of toDelete) {
      await store.deleteProduct(p.id)
    }

    setGroups((prev) => prev.filter((_, i) => i !== groupIdx))
    setProducts((prev) => prev.filter((p) => !toDelete.some((d) => d.id === p.id)))
    setSuccessMsg(`Kept 1 (qty: ${group.keepQty}), removed ${toDelete.length}`)
    setMerging(false)
    setTimeout(() => setSuccessMsg(""), 3000)
  }

  const mergeAll = async () => {
    setMerging(true)
    let totalDeleted = 0
    const toMerge = groups.filter((g) => !g.isFalsePositive && g.deleteIds.size > 0)
    for (const group of toMerge) {
      const toDelete = group.products.filter((p) => group.deleteIds.has(p.id))
      const kept = group.products.find((p) => !group.deleteIds.has(p.id))

      if (kept && group.keepQty > 1) {
        try {
          const locations = await store.getProductLocations(kept.id)
          if (locations.length > 0) {
            await store.updateProductLocation(locations[0].id, { quantity: group.keepQty })
          }
        } catch (e) {
          console.error("Failed to set qty:", e)
        }
      }

      for (const p of toDelete) {
        await store.deleteProduct(p.id)
        totalDeleted++
      }
    }
    const remaining = await store.getProducts()
    setProducts(remaining)
    setGroups(findDuplicateGroups(remaining, placedProductIds))
    setSuccessMsg(`Merged ${toMerge.length} groups: removed ${totalDeleted} duplicate${totalDeleted !== 1 ? "s" : ""}`)
    setMerging(false)
    setTimeout(() => setSuccessMsg(""), 5000)
  }

  const dismissFalsePositive = (groupIdx: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== groupIdx))
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/products">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-bold">Find Duplicates</h1>
          <p className="text-[12px] text-muted-foreground">
            {trueDupes.length} duplicate group{trueDupes.length !== 1 ? "s" : ""} · {totalMarkedForDeletion} marked for deletion
            {falsePositives.length > 0 && ` · ${falsePositives.length} possible false positive${falsePositives.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {trueDupes.length > 0 && totalMarkedForDeletion > 0 && (
          <Button size="sm" onClick={() => mergeAll()} disabled={merging}>
            <Trash2 className="size-3.5" />
            {merging ? "Merging..." : `Delete All Dupes (${totalMarkedForDeletion})`}
          </Button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700 dark:text-emerald-400">
          <Check className="size-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Empty state */}
      {trueDupes.length === 0 && falsePositives.length === 0 && !successMsg && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Check className="size-8 text-emerald-500" />
          </div>
          <h2 className="text-[15px] font-semibold mb-1">No duplicates found</h2>
          <p className="text-[13px] text-muted-foreground">
            All {products.length} products appear to be unique.
          </p>
        </div>
      )}

      {/* True duplicate groups */}
      {trueDupes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[14px] font-semibold text-destructive">
            True Duplicates ({trueDupes.length} groups)
          </h2>
          {trueDupes.map((group) => {
            const gi = groups.indexOf(group)
            return <GroupCard key={gi} group={group} gi={gi} placedProductIds={placedProductIds} merging={merging} toggleDelete={toggleDelete} mergeGroup={mergeGroup} updateKeepQty={updateKeepQty} />
          })}
        </div>
      )}

      {/* False positives */}
      {falsePositives.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowFalsePositives(!showFalsePositives)}
            className="flex items-center gap-2 text-[14px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{showFalsePositives ? "▼" : "▶"}</span>
            Possible False Positives ({falsePositives.length} groups)
            <span className="text-[11px] font-normal">— similar names but likely separate purchases</span>
          </button>
          {showFalsePositives && falsePositives.map((group) => {
            const gi = groups.indexOf(group)
            return (
              <div key={gi}>
                <GroupCard group={group} gi={gi} placedProductIds={placedProductIds} merging={merging} toggleDelete={toggleDelete} mergeGroup={mergeGroup} updateKeepQty={updateKeepQty} />
                <button
                  onClick={() => dismissFalsePositive(gi)}
                  className="mt-1 text-[11px] text-muted-foreground hover:text-foreground ml-4"
                >
                  Not a duplicate — dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function GroupCard({
  group, gi, placedProductIds, merging, toggleDelete, mergeGroup, updateKeepQty,
}: {
  group: DupeGroup
  gi: number
  placedProductIds: Set<string>
  merging: boolean
  toggleDelete: (gi: number, id: string) => void
  mergeGroup: (gi: number) => void
  updateKeepQty: (gi: number, qty: number) => void
}) {
  const keepCount = group.products.length - group.deleteIds.size
  return (
    <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div>
          <span className="text-[13px] font-medium">
            {group.products.length} products · keep {keepCount}, delete {group.deleteIds.size}
          </span>
          <span className="ml-2 text-[11px] text-muted-foreground">({group.reason})</span>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => mergeGroup(gi)}
          disabled={merging || group.deleteIds.size === 0}
          className="text-[11px] h-7 px-2.5"
        >
          <Trash2 className="size-3" />
          Delete Checked ({group.deleteIds.size})
        </Button>
      </div>

      <div className="divide-y">
        {group.products.map((product) => {
          const isMarkedDelete = group.deleteIds.has(product.id)
          const hasLocation = placedProductIds.has(product.id)
          const isKept = !isMarkedDelete
          // Show qty input on the first kept product only
          const keptProducts = group.products.filter((p) => !group.deleteIds.has(p.id))
          const isFirstKept = isKept && keptProducts[0]?.id === product.id
          return (
            <label
              key={product.id}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                isMarkedDelete ? "bg-red-500/5" : "bg-emerald-500/5 hover:bg-emerald-500/8"
              }`}
            >
              <input
                type="checkbox"
                checked={isMarkedDelete}
                onChange={() => toggleDelete(gi, product.id)}
                className="mt-1 rounded accent-red-600"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[13px] font-medium truncate ${isMarkedDelete ? "line-through text-muted-foreground" : ""}`}>
                    {product.name}
                  </span>
                  {hasLocation && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded-4xl">
                      <MapPin className="size-2.5" />
                      Placed
                    </span>
                  )}
                  {isMarkedDelete ? (
                    <span className="shrink-0 text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-4xl">
                      DELETE
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-4xl">
                      KEEP
                    </span>
                  )}
                  {isFirstKept && group.deleteIds.size > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      Qty:
                      <input
                        type="number"
                        min="1"
                        value={group.keepQty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateKeepQty(gi, parseInt(e.target.value) || 1) }}
                        className="w-12 rounded border bg-background px-1.5 py-0.5 text-[11px] text-center"
                      />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                  {product.brand && (
                    <span><span className="text-muted-foreground/50">Brand:</span> {product.brand}</span>
                  )}
                  <span><span className="text-muted-foreground/50">Price:</span> {formatPrice(product.price, product.currency)}</span>
                  {product.retailer && (
                    <span><span className="text-muted-foreground/50">Retailer:</span> {product.retailer}</span>
                  )}
                  <span><span className="text-muted-foreground/50">Purchased:</span> {formatDate(product.purchase_date)}</span>
                  {product.order_id && (
                    <span><span className="text-muted-foreground/50">Order:</span> {product.order_id}</span>
                  )}
                  <span><span className="text-muted-foreground/50">Added:</span> {formatDate(product.date_added)}</span>
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

function formatPrice(price?: number, currency?: string): string {
  if (price == null) return "-"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(price)
}
