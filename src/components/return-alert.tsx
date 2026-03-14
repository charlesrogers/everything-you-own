"use client"

import Link from "next/link"
import { Package, Clock } from "lucide-react"
import type { ReturnAlert } from "@/lib/store"

interface ReturnAlertCardProps {
  alert: ReturnAlert
  type?: "return" | "warranty"
}

function urgencyClass(daysLeft: number): string {
  if (daysLeft <= 3) return "border-l-4 border-l-red-500"
  if (daysLeft <= 14) return "border-l-4 border-l-amber-500"
  return "border-l-4 border-l-muted-foreground/30"
}

function urgencyBadgeClass(daysLeft: number): string {
  if (daysLeft <= 3) return "bg-red-500/10 text-red-600 dark:text-red-400"
  if (daysLeft <= 14) return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

export function ReturnAlertCard({ alert, type = "return" }: ReturnAlertCardProps) {
  const { product, daysLeft } = alert
  const label = type === "return" ? "to return" : "warranty"

  return (
    <Link
      href={`/products/${product.id}`}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${urgencyClass(daysLeft)} hover:shadow-sm transition-shadow`}
    >
      <div className="size-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="size-5 text-muted-foreground/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{product.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {product.retailer && `${product.retailer} · `}
          {product.price != null && `$${product.price.toFixed(2)}`}
        </p>
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium shrink-0 ${urgencyBadgeClass(daysLeft)}`}>
        <Clock className="size-3" />
        {daysLeft === 0 ? "Today" : `${daysLeft}d ${label}`}
      </div>
    </Link>
  )
}
