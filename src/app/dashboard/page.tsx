"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, AlertTriangle, ShoppingBag, Clock } from "lucide-react"
import { getReturnAlerts, getWarrantyAlerts, getSpendingByCategory, getRecentProducts } from "@/lib/store"
import { getCategories, getSubcategories } from "@/lib/store"
import type { ReturnAlert, CategorySpending } from "@/lib/store"
import type { Product, Category, Subcategory } from "@/lib/types"
import { ReturnAlertCard } from "@/components/return-alert"
import { SpendingCard } from "@/components/spending-card"
import { StatusBadge } from "@/components/status-badge"

export default function DashboardPage() {
  const [returnAlerts, setReturnAlerts] = useState<ReturnAlert[]>([])
  const [warrantyAlerts, setWarrantyAlerts] = useState<ReturnAlert[]>([])
  const [spending, setSpending] = useState<CategorySpending[]>([])
  const [recent, setRecent] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  useEffect(() => {
    setReturnAlerts(getReturnAlerts())
    setWarrantyAlerts(getWarrantyAlerts())
    setSpending(getSpendingByCategory())
    setRecent(getRecentProducts(10))
    setCategories(getCategories())
    setSubcategories(getSubcategories())
  }, [])

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const subMap = new Map(subcategories.map((s) => [s.id, s]))
  const totalSpend = spending.reduce((sum, s) => sum + s.totalSpend, 0)
  const totalItems = spending.reduce((sum, s) => sum + s.itemCount, 0)
  const hasAlerts = returnAlerts.length > 0 || warrantyAlerts.length > 0

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

      {/* Recent Activity */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Clock className="size-4" />
            Recently Added
          </h2>
          <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden divide-y">
            {recent.map((product) => {
              const cat = catMap.get(product.category_id)
              const sub = subMap.get(product.subcategory_id)
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
                  <div className="flex items-center gap-3 shrink-0">
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
