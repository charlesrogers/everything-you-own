"use client"

import Link from "next/link"
import { Package, Clock, Lock } from "lucide-react"
import { Product, Category, Subcategory } from "@/lib/types"
import { StatusBadge } from "./status-badge"

interface ProductCardProps {
  product: Product
  category?: Category
  subcategory?: Subcategory
}

function getReturnDaysLeft(product: Product): number | null {
  if (!product.return_by_date || product.status === "returned") return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const returnDate = new Date(product.return_by_date)
  returnDate.setHours(0, 0, 0, 0)
  const days = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return days >= 0 && days <= 14 ? days : null
}

export function ProductCard({ product, category, subcategory }: ProductCardProps) {
  const daysLeft = getReturnDaysLeft(product)
  const urgencyBorder = daysLeft !== null
    ? daysLeft <= 3 ? "border-t-4 border-t-red-500" : "border-t-4 border-t-amber-500"
    : ""

  return (
    <Link
      href={`/products/${product.id}`}
      className={`group rounded-xl border bg-card shadow-sm shadow-black/[0.04] overflow-hidden hover:shadow-md hover:shadow-black/[0.06] transition-shadow ${urgencyBorder}`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Package className="size-12 text-muted-foreground/30" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 flex items-center gap-1">
            {product.name}
            {product.visibility === "private" && <Lock className="size-3 text-muted-foreground/50 shrink-0" />}
          </h3>
          <StatusBadge status={product.status} />
        </div>
        {product.brand && (
          <p className="text-[12px] text-muted-foreground">{product.brand}</p>
        )}
        <div className="flex items-center justify-between">
          {product.price != null && (
            <span className="text-[13px] font-semibold">
              ${product.price.toFixed(2)}
            </span>
          )}
          {category && (
            <span className="text-[11px] text-muted-foreground">
              {category.name}
              {subcategory && ` · ${subcategory.name}`}
            </span>
          )}
        </div>
        {product.rating != null && (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-[11px] ${star <= product.rating! ? "text-amber-500" : "text-muted-foreground/20"}`}
              >
                ★
              </span>
            ))}
          </div>
        )}
        {daysLeft !== null && (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${daysLeft <= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
            <Clock className="size-3" />
            {daysLeft === 0 ? "Return today" : `${daysLeft}d left to return`}
          </div>
        )}
      </div>
    </Link>
  )
}
