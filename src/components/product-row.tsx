"use client"

import Link from "next/link"
import { Package } from "lucide-react"
import { Product, Category, Subcategory } from "@/lib/types"
import { StatusBadge } from "./status-badge"
import { TableCell, TableRow } from "./ui/table"

interface ProductRowProps {
  product: Product
  category?: Category
  subcategory?: Subcategory
}

export function ProductRow({ product, category, subcategory }: ProductRowProps) {
  return (
    <TableRow className="cursor-pointer">
      <TableCell>
        <Link href={`/products/${product.id}`} className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="size-10 object-cover" />
            ) : (
              <Package className="size-4 text-muted-foreground/30" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{product.name}</p>
            {product.brand && (
              <p className="text-[11px] text-muted-foreground">{product.brand}</p>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-[12px] text-muted-foreground">
        {category?.name}
        {subcategory && ` · ${subcategory.name}`}
      </TableCell>
      <TableCell className="text-[13px] font-medium">
        {product.price != null ? `$${product.price.toFixed(2)}` : "—"}
      </TableCell>
      <TableCell>
        <StatusBadge status={product.status} />
      </TableCell>
      <TableCell className="text-[11px] text-muted-foreground">
        {product.purchase_date
          ? new Date(product.purchase_date).toLocaleDateString()
          : new Date(product.date_added).toLocaleDateString()}
      </TableCell>
    </TableRow>
  )
}
