"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Package, Plus, Search } from "lucide-react"
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
  const [products, setProducts] = useState<Product[]>([])
  const [unsorted, setUnsorted] = useState<{ id: string; name: string; brand: string | null; image_url: string | null }[]>([])
  const [tab, setTab] = useState<"search" | "unsorted">("unsorted")
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      store.getLocation(locationId),
      store.getLocationBreadcrumbs(locationId),
      store.getUnsortedProducts(),
    ]).then(([loc, crumbs, uns]) => {
      setLocation(loc ?? null)
      setBreadcrumbs(crumbs)
      setUnsorted(uns)
    })
  }, [locationId, authLoading])

  useEffect(() => {
    if (tab === "search" && searchQuery.trim()) {
      store.searchProducts(searchQuery).then(setProducts)
    }
  }, [searchQuery, tab])

  const handleAdd = async (productId: string) => {
    setAdding(productId)
    await store.addProductToLocation({
      product_id: productId,
      location_id: locationId,
    })
    setUnsorted((prev) => prev.filter((p) => p.id !== productId))
    setProducts((prev) => prev.filter((p) => p.id !== productId))
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
          onClick={() => setTab("search")}
          className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            tab === "search" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Search All Products
        </button>
      </div>

      {/* Search input */}
      {tab === "search" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
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
          </div>
        )}
        {tab === "search" && !searchQuery.trim() && (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            Type to search your products.
          </div>
        )}
        {(tab === "unsorted" ? unsorted : products).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
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
              {item.brand && (
                <span className="text-[11px] text-muted-foreground">{item.brand}</span>
              )}
            </div>
            <button
              onClick={() => handleAdd(item.id)}
              disabled={adding === item.id}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Plus className="size-3" />
              {adding === item.id ? "Adding..." : "Add"}
            </button>
          </div>
        ))}
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
