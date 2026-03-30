"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, AlertTriangle, ShoppingBag, Clock, MapPinOff, ArrowUpDown, User } from "lucide-react"
import type { ReturnAlert, CategorySpending } from "@/lib/store"
import type { Product, Category, Subcategory } from "@/lib/types"
import { ReturnAlertCard } from "@/components/return-alert"
import { SpendingCard } from "@/components/spending-card"
import { StatusBadge } from "@/components/status-badge"
import { useStore } from "@/hooks/use-store"
import { LoadingSkeleton } from "@/components/loading-skeleton"

type SortOrder = "newest" | "oldest"
type LocationFilter = "all" | "unplaced"

export default function DashboardPage() {
  const store = useStore()
  const [returnAlerts, setReturnAlerts] = useState<ReturnAlert[]>([])
  const [warrantyAlerts, setWarrantyAlerts] = useState<ReturnAlert[]>([])
  const [spending, setSpending] = useState<CategorySpending[]>([])
  const [recent, setRecent] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all")
  const [placedProductIds, setPlacedProductIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [ra, wa, sp, rec, cats, subs, prods] = await Promise.all([
        store.getReturnAlerts(),
        store.getWarrantyAlerts(),
        store.getSpendingByCategory(),
        store.getRecentProducts(50),
        store.getCategories(),
        store.getSubcategories(),
        store.getProducts(),
      ])
      setReturnAlerts(ra)
      setWarrantyAlerts(wa)
      setSpending(sp)
      setRecent(rec)
      setCategories(cats)
      setSubcategories(subs)
      setAllProducts(prods)

      // Get placed product IDs from storage API
      try {
        const res = await fetch("/api/storage")
        const data = await res.json()
        // itemCounts keys are location IDs, but we need product IDs
        // Fetch product_locations to get the set of placed product IDs
        const unsorted = await store.getUnsortedProducts()
        const unsortedIds = new Set(unsorted.map((u) => u.id))
        const placed = new Set(prods.filter((p: Product) => !unsortedIds.has(p.id)).map((p: Product) => p.id))
        setPlacedProductIds(placed)
      } catch {}

      setLoading(false)
    }
    load()
  }, [store])

  if (loading) return <LoadingSkeleton />

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const subMap = new Map(subcategories.map((s) => [s.id, s]))
  const totalSpend = spending.reduce((sum, s) => sum + s.totalSpend, 0)
  const totalItems = spending.reduce((sum, s) => sum + s.itemCount, 0)
  const hasAlerts = returnAlerts.length > 0 || warrantyAlerts.length > 0

  // Filter and sort products
  let displayProducts = [...recent]
  if (locationFilter === "unplaced") {
    displayProducts = displayProducts.filter((p) => !placedProductIds.has(p.id))
  }
  if (sortOrder === "oldest") {
    displayProducts.reverse()
  }

  const unplacedCount = allProducts.filter((p) => !placedProductIds.has(p.id)).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">Dashboard</h1>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:translate-y-px"
        >
          <Package className="size-3.5" />
          Add Product
        </Link>
      </div>

      {/* Action Alerts */}
      {hasAlerts && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <AlertTriangle className="size-4 text-amber-500" />
            Action Required
          </h2>

          {returnAlerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Return Deadlines</h3>
              <div className="grid gap-2">
                {returnAlerts.map((alert) => (
                  <ReturnAlertCard key={alert.product.id} alert={alert} type="return" />
                ))}
              </div>
            </div>
          )}

          {warrantyAlerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Warranty Expiring</h3>
              <div className="grid gap-2">
                {warrantyAlerts.map((alert) => (
                  <ReturnAlertCard key={alert.product.id} alert={alert} type="warranty" />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Spending by Category */}
      {spending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <ShoppingBag className="size-4" />
              Spending by Category
            </h2>
            <span className="text-[12px] text-muted-foreground">
              ${totalSpend.toFixed(0)} across {totalItems} item{totalItems !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {spending.map((s) => (
              <SpendingCard key={s.category.id} data={s} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity with filters */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Clock className="size-4" />
              Products
            </h2>
            <div className="flex items-center gap-2">
              {/* Location filter */}
              <button
                onClick={() => setLocationFilter(locationFilter === "all" ? "unplaced" : "all")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  locationFilter === "unplaced"
                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPinOff className="size-3" />
                {locationFilter === "unplaced" ? `Unplaced (${unplacedCount})` : "Unplaced"}
              </button>
              {/* Sort */}
              <button
                onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowUpDown className="size-3" />
                {sortOrder === "newest" ? "Newest" : "Oldest"}
              </button>
            </div>
          </div>
          <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
            {displayProducts.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-muted-foreground">
                {locationFilter === "unplaced" ? "All products have been placed in storage!" : "No products yet."}
              </div>
            ) : displayProducts.map((product) => {
              const cat = product.category_id ? catMap.get(product.category_id) : undefined
              const sub = product.subcategory_id ? subMap.get(product.subcategory_id) : undefined
              const isPlaced = placedProductIds.has(product.id)
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="size-4 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {cat?.name}{sub ? ` · ${sub.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {product.ownership && product.ownership !== "mine" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        <User className="size-2.5" />
                        {product.ownership}
                      </span>
                    )}
                    {!isPlaced && (
                      <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        unplaced
                      </span>
                    )}
                    {product.price != null && (
                      <span className="text-[13px] font-semibold">${product.price.toFixed(2)}</span>
                    )}
                    <StatusBadge status={product.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasAlerts && spending.length === 0 && recent.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-[15px] font-semibold mb-1">No products yet</h2>
          <p className="text-[13px] text-muted-foreground mb-4">
            Add your first product to start tracking what you own.
          </p>
          <Link
            href="/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add Product
          </Link>
        </div>
      )}
    </div>
  )
}
