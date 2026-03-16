"use client"

import Link from "next/link"
import type { Product } from "@/lib/types"

interface Props {
  data: Product[]
}

export function TopItemsList({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-8 text-center">No priced products yet</p>
  }

  return (
    <div className="space-y-1">
      {data.map((p, i) => (
        <Link
          key={p.id}
          href={`/products/${p.id}`}
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <span className="text-[11px] text-muted-foreground w-5 text-right">{i + 1}.</span>
          {p.image_url ? (
            <img src={p.image_url} alt="" className="size-7 rounded object-cover" />
          ) : (
            <div className="size-7 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate">{p.name}</p>
            {p.brand && <p className="text-[11px] text-muted-foreground">{p.brand}</p>}
          </div>
          <span className="text-[13px] font-semibold">${p.price?.toFixed(2)}</span>
        </Link>
      ))}
    </div>
  )
}
