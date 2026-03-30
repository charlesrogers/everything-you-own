"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { Plus, LayoutGrid, List, Search, GitMerge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductCard } from "@/components/product-card"
import { ProductRow } from "@/components/product-row"
import { Checkbox } from "@/components/ui/checkbox"
import { Product, Category, Subcategory, ProductStatus, ProductOwnership, SortField, ViewMode } from "@/lib/types"
import { OWNERSHIP_OPTIONS } from "@/lib/constants"
import { useStore } from "@/hooks/use-store"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function ProductsPage() {
  const store = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [status, setStatus] = useState<ProductStatus | "all">("all")
  const [categoryId, setCategoryId] = useState("")
  const [sortField, setSortField] = useState<SortField>("date_added")
  const [query, setQuery] = useState("")
  const [ownership, setOwnership] = useState<ProductOwnership | "all">("all")
  const [hideConsumables, setHideConsumables] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [cats, subs] = await Promise.all([
        store.getCategories(),
        store.getSubcategories(),
      ])
      setCategories(cats)
      setSubcategories(subs)
      setLoading(false)
    }
    init()
  }, [store])

  const refreshProducts = useCallback(async () => {
    const filtered = await store.filterProducts({
      status,
      categoryId: categoryId || undefined,
      query: query || undefined,
      sortField,
      sortDirection: sortField === "name" ? "asc" : "desc",
      ownership,
      hideConsumables,
    })
    setProducts(filtered)
  }, [store, status, categoryId, query, sortField, ownership, hideConsumables])

  useEffect(() => {
    if (!loading) refreshProducts()
  }, [loading, refreshProducts])

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const subMap = useMemo(() => {
    const m = new Map<string, Subcategory>()
    subcategories.forEach((s) => m.set(s.id, s))
    return m
  }, [subcategories])

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <Link href="/products/dedupe">
            <Button size="sm" variant="outline">
              <GitMerge className="size-4" />
              Find Duplicates
            </Button>
          </Link>
          <Link href="/products/new">
            <Button size="sm">
              <Plus className="size-4" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryId || "all"} onValueChange={(v: string | null) => setCategoryId(!v || v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories">
              {categoryId ? categories.find((c) => c.id === categoryId)?.name : "All Categories"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => v && setSortField(v as SortField)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue>
              {{ date_added: "Date Added", price: "Price", name: "Name", purchase_date: "Purchase Date" }[sortField]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_added">Date Added</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownership} onValueChange={(v) => v && setOwnership(v as ProductOwnership | "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue>
              {ownership === "all" ? "All Owners" : OWNERSHIP_OPTIONS.find((o) => o.value === ownership)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {OWNERSHIP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-pointer whitespace-nowrap">
          <Checkbox
            checked={hideConsumables}
            onCheckedChange={(v) => setHideConsumables(v === true)}
          />
          Hide consumables
        </label>

        <div className="flex rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center justify-center size-7 rounded-md transition-colors ${
              viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center justify-center size-7 rounded-md transition-colors ${
              viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={status} onValueChange={(v) => setStatus(v as ProductStatus | "all")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="purchased">Purchased</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
          <TabsTrigger value="gifted">Gifted</TabsTrigger>
          <TabsTrigger value="sold">Sold</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Product Display */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="size-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-[15px] font-semibold mb-1">No products yet</h2>
          <p className="text-[13px] text-muted-foreground mb-4">
            Add your first product to start building your collection.
          </p>
          <Link href="/products/new">
            <Button>Add Product</Button>
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              category={product.category_id ? catMap.get(product.category_id) : undefined}
              subcategory={product.subcategory_id ? subMap.get(product.subcategory_id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  category={product.category_id ? catMap.get(product.category_id) : undefined}
                  subcategory={product.subcategory_id ? subMap.get(product.subcategory_id) : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        {products.length} product{products.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
