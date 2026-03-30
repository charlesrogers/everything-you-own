"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, GitMerge, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/hooks/use-store"
import { useAuth } from "@/components/auth-provider"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import type { Product } from "@/lib/types"

interface DupeGroup {
  reason: string
  products: Product[]
  keepId: string // which product to keep
}

function normalizeForComparison(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

function findDuplicateGroups(products: Product[]): DupeGroup[] {
  const assigned = new Set<string>()
  const groups: DupeGroup[] = []

  // Pass 1: Exact name match
  const byNormalizedName = new Map<string, Product[]>()
  for (const p of products) {
    const key = normalizeForComparison(p.name)
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, [])
    byNormalizedName.get(key)!.push(p)
  }
  for (const [, prods] of byNormalizedName) {
    if (prods.length < 2) continue
    const ids = prods.map((p) => p.id)
    if (ids.some((id) => assigned.has(id))) continue
    ids.forEach((id) => assigned.add(id))
    const oldest = [...prods].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    groups.push({ reason: "Exact name match", products: prods, keepId: oldest.id })
  }

  // Pass 2: Same order_id + retailer (both non-empty)
  const byOrder = new Map<string, Product[]>()
  for (const p of products) {
    if (assigned.has(p.id)) continue
    if (!p.order_id || !p.retailer) continue
    const key = `${p.order_id.trim().toLowerCase()}|${p.retailer.trim().toLowerCase()}`
    if (!byOrder.has(key)) byOrder.set(key, [])
    byOrder.get(key)!.push(p)
  }
  for (const [, prods] of byOrder) {
    if (prods.length < 2) continue
    // Only group if names are similar (not just same order)
    // Group by similar names within same order
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
      const ids = nameGroup.map((p) => p.id)
      if (ids.some((id) => assigned.has(id))) continue
      ids.forEach((id) => assigned.add(id))
      const oldest = [...nameGroup].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      groups.push({ reason: "Same order + similar name", products: nameGroup, keepId: oldest.id })
    }
  }

  // Pass 3: Same name + price + retailer
  const byNamePriceRetailer = new Map<string, Product[]>()
  for (const p of products) {
    if (assigned.has(p.id)) continue
    if (!p.retailer || p.price == null) continue
    const key = `${normalizeForComparison(p.name)}|${p.price}|${p.retailer.trim().toLowerCase()}`
    if (!byNamePriceRetailer.has(key)) byNamePriceRetailer.set(key, [])
    byNamePriceRetailer.get(key)!.push(p)
  }
  for (const [, prods] of byNamePriceRetailer) {
    if (prods.length < 2) continue
    const ids = prods.map((p) => p.id)
    if (ids.some((id) => assigned.has(id))) continue
    ids.forEach((id) => assigned.add(id))
    const oldest = [...prods].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    groups.push({ reason: "Same name + price + retailer", products: prods, keepId: oldest.id })
  }

  // Pass 4: Fuzzy substring match (shorter is >60% of longer)
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
      fuzzyGroup.forEach((p) => assigned.add(p.id))
      const oldest = [...fuzzyGroup].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      groups.push({ reason: "Similar name (fuzzy)", products: fuzzyGroup, keepId: oldest.id })
    }
  }

  return groups
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

export default function DedupePage() {
  const store = useStore()
  useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<DupeGroup[]>([])
  const [merging, setMerging] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    async function load() {
      const all = await store.getProducts()
      setProducts(all)
      setGroups(findDuplicateGroups(all))
      setLoading(false)
    }
    load()
  }, [store])

  const totalDupeProducts = useMemo(
    () => groups.reduce((sum, g) => sum + g.products.length, 0),
    [groups]
  )

  const updateKeep = (groupIdx: number, productId: string) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, keepId: productId } : g))
    )
  }

  const mergeGroup = async (groupIdx: number) => {
    setMerging(true)
    const group = groups[groupIdx]
    const toDelete = group.products.filter((p) => p.id !== group.keepId)
    for (const p of toDelete) {
      await store.deleteProduct(p.id)
    }
    // Remove group and refresh
    setGroups((prev) => prev.filter((_, i) => i !== groupIdx))
    setProducts((prev) => prev.filter((p) => !toDelete.some((d) => d.id === p.id)))
    setSuccessMsg(`Merged group: kept 1, removed ${toDelete.length}`)
    setMerging(false)
    setTimeout(() => setSuccessMsg(""), 3000)
  }

  const mergeAll = async () => {
    setMerging(true)
    let totalDeleted = 0
    for (const group of groups) {
      const toDelete = group.products.filter((p) => p.id !== group.keepId)
      for (const p of toDelete) {
        await store.deleteProduct(p.id)
        totalDeleted++
      }
    }
    setGroups([])
    const remaining = await store.getProducts()
    setProducts(remaining)
    setSuccessMsg(`Merged all groups: removed ${totalDeleted} duplicate${totalDeleted !== 1 ? "s" : ""}`)
    setMerging(false)
    setTimeout(() => setSuccessMsg(""), 5000)
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
            Found {groups.length} potential duplicate group{groups.length !== 1 ? "s" : ""} ({totalDupeProducts} total products)
          </p>
        </div>
        {groups.length > 0 && (
          <Button size="sm" onClick={mergeAll} disabled={merging}>
            <GitMerge className="size-4" />
            {merging ? "Merging..." : "Merge All"}
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
      {groups.length === 0 && !successMsg && (
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

      {/* Duplicate groups */}
      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div>
                <span className="text-[13px] font-medium">{group.products.length} potential duplicates</span>
                <span className="ml-2 text-[11px] text-muted-foreground">({group.reason})</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mergeGroup(gi)}
                disabled={merging}
              >
                <GitMerge className="size-3.5" />
                Merge
              </Button>
            </div>

            <div className="divide-y">
              {group.products.map((product) => {
                const isKept = product.id === group.keepId
                return (
                  <label
                    key={product.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isKept ? "bg-emerald-500/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`group-${gi}`}
                      checked={isKept}
                      onChange={() => updateKeep(gi, product.id)}
                      className="mt-1 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{product.name}</span>
                        {isKept && (
                          <span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-4xl">
                            KEEP
                          </span>
                        )}
                        {!isKept && (
                          <span className="shrink-0 text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-4xl">
                            DELETE
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
        ))}
      </div>
    </div>
  )
}
