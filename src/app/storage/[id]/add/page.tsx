"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Package, Plus, Search, Check, MapPin } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/hooks/use-store"
import type { Location, LocationBreadcrumb } from "@/lib/wms-types"
import type { Product } from "@/lib/types"

export default function AddItemToLocationPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading } = useAuth()
  const store = useStore()
  const locationId = params.id as string

  const [location, setLocation] = useState<Location | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<LocationBreadcrumb[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [unsorted, setUnsorted] = useState<{ id: string; name: string; brand: string | null; image_url: string | null }[]>([])
  const [tab, setTab] = useState<"unsorted" | "all">("unsorted")
  const [adding, setAdding] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())
  const [existingItemIds, setExistingItemIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      store.getLocation(locationId),
      store.getLocationBreadcrumbs(locationId),
      store.getUnsortedProducts(),
      store.getProducts(),
      fetch(`/api/storage?id=${locationId}`).then((r) => r.json()),
    ]).then(([loc, crumbs, uns, prods, locData]) => {
      setLocation(loc ?? null)
      setBreadcrumbs(crumbs)
      setUnsorted(uns)
      setAllProducts(prods)
      // Track which products are already in this specific location
      const contents = locData.contents ?? []
      setExistingItemIds(new Set(contents.map((c: { product_id: string }) => c.product_id)))
    })
  }, [locationId, authLoading])

  const filtered = searchQuery.trim()
    ? allProducts.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false) ||
          (p.retailer?.toLowerCase().includes(q) ?? false)
        )
      })
    : allProducts

  const handleAdd = async (productId: string) => {
    setAdding(productId)
    await store.addProductToLocation({
      product_id: productId,
      location_id: locationId,
    })
    setUnsorted((prev) => prev.filter((p) => p.id !== productId))
    setExistingItemIds((prev) => new Set([...prev, productId]))
    setJustAdded((prev) => new Set([...prev, productId]))
    setAdding(null)
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
        <Link href="/storage" className="hover:text-foreground transition-colors">
          Storage
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            <Link href={`/storage/${crumb.id}`} className="hover:text-foreground transition-colors">
              {crumb.name}
            </Link>
          </span>
        ))}
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">Add Item</span>
      </div>

      <div>
        <h1 className="text-[20px] font-bold">Add Item to {location.name}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("unsorted")}
          className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "unsorted" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Unsorted ({unsorted.length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "all" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Products ({allProducts.length})
        </button>
      </div>

      {/* Search input — shown for All Products tab */}
      {tab === "all" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter products..."
            className="w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-[13px]"
            autoFocus
          />
        </div>
      )}

      {/* Product list */}
      <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
        {tab === "unsorted" && unsorted.length === 0 && (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            All products have been assigned to locations.
            <button
              onClick={() => setTab("all")}
              className="block mx-auto mt-2 text-primary hover:text-primary/80 font-medium"
            >
              Browse all products instead
            </button>
          </div>
        )}
        {tab === "all" && filtered.length === 0 && (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            {searchQuery.trim() ? "No products match your search." : "No products in your database yet."}
          </div>
        )}
        {(tab === "unsorted" ? unsorted : filtered).map((item) => {
          const alreadyHere = existingItemIds.has(item.id)
          const wasJustAdded = justAdded.has(item.id)

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                alreadyHere ? "bg-primary/5" : "hover:bg-accent/50"
              }`}
            >
              {"image_url" in item && item.image_url ? (
                <img
                  src={item.image_url as string}
                  alt={item.name}
                  className="size-10 rounded-lg object-cover border"
                />
              ) : (
                <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium text-foreground truncate block">
                  {item.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {item.brand && (
                    <span className="text-[11px] text-muted-foreground">{item.brand}</span>
                  )}
                </div>
              </div>
              {alreadyHere ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-primary">
                  <Check className="size-3" />
                  {wasJustAdded ? "Added" : "Here"}
                </span>
              ) : (
                <button
                  onClick={() => handleAdd(item.id)}
                  disabled={adding === item.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Plus className="size-3" />
                  {adding === item.id ? "Adding..." : "Add"}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <Link
        href={`/storage/${locationId}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to {location.name}
      </Link>
    </div>
  )
}
