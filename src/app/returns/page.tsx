"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { RotateCcw, Clock, Package, Store, Calendar, DollarSign } from "lucide-react"
import { getReturnAlerts, ReturnAlert, getCategories } from "@/lib/store"
import { Category } from "@/lib/types"

export default function ReturnsPage() {
  const [alerts, setAlerts] = useState<ReturnAlert[]>([])
  const [categories, setCategories] = useState<Map<string, Category>>(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setAlerts(getReturnAlerts())
    const cats = getCategories()
    setCategories(new Map(cats.map((c) => [c.id, c])))
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold">Returns</h1>
        <p className="text-[12px] text-muted-foreground mt-1">
          {alerts.length === 0
            ? "No items within a return window"
            : `${alerts.length} item${alerts.length === 1 ? "" : "s"} still returnable`}
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RotateCcw className="size-12 text-muted-foreground/30 mb-4" />
          <p className="text-[13px] text-muted-foreground mb-2">No items within a return window</p>
          <Link
            href="/products"
            className="text-[13px] font-medium text-primary hover:underline"
          >
            View all products
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map(({ product, daysLeft }) => {
            const urgencyColor =
              daysLeft <= 3
                ? "border-l-red-500"
                : daysLeft <= 7
                  ? "border-l-amber-500"
                  : "border-l-emerald-500"
            const urgencyText =
              daysLeft <= 3
                ? "text-red-600 dark:text-red-400"
                : daysLeft <= 7
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            const urgencyBg =
              daysLeft <= 3
                ? "bg-red-50 dark:bg-red-950/30"
                : daysLeft <= 7
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-emerald-50 dark:bg-emerald-950/30"
            const category = categories.get(product.category_id)

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className={`group rounded-xl border border-l-4 ${urgencyColor} bg-card shadow-sm shadow-black/[0.04] overflow-hidden hover:shadow-md hover:shadow-black/[0.06] transition-shadow`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Image or placeholder */}
                  <div className="size-14 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="size-6 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-medium truncate">{product.name}</h3>
                        {product.brand && (
                          <p className="text-[12px] text-muted-foreground">{product.brand}</p>
                        )}
                      </div>
                      <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-4xl text-[10px] font-semibold ${urgencyText} ${urgencyBg}`}>
                        <Clock className="size-3" />
                        {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      {product.price != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="size-3" />
                          {product.price.toFixed(2)}
                        </span>
                      )}
                      {product.retailer && (
                        <span className="flex items-center gap-1">
                          <Store className="size-3" />
                          {product.retailer}
                        </span>
                      )}
                      {category && (
                        <span>{category.name}</span>
                      )}
                      {product.return_by_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          Return by {new Date(product.return_by_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
