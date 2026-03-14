"use client"

import type { CategorySpending } from "@/lib/store"
import { Sparkline } from "./sparkline"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface SpendingCardProps {
  data: CategorySpending
}

function TrendIndicator({ monthlySpend }: { monthlySpend: { month: string; amount: number }[] }) {
  if (monthlySpend.length < 2) {
    return <Minus className="size-3.5 text-muted-foreground" />
  }
  const recent = monthlySpend[monthlySpend.length - 1].amount
  const prev = monthlySpend[monthlySpend.length - 2].amount
  if (recent > prev) return <TrendingUp className="size-3.5 text-emerald-500" />
  if (recent < prev) return <TrendingDown className="size-3.5 text-red-500" />
  return <Minus className="size-3.5 text-muted-foreground" />
}

export function SpendingCard({ data }: SpendingCardProps) {
  const { category, totalSpend, itemCount, avgPrice, lastPurchase, monthlySpend } = data

  const lastPurchaseLabel = lastPurchase
    ? new Date(lastPurchase).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null

  return (
    <div className="rounded-xl border bg-card shadow-sm shadow-black/[0.04] p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold truncate">{category.name}</h3>
        <div className="flex items-center gap-1">
          <TrendIndicator monthlySpend={monthlySpend} />
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-[20px] font-bold">${totalSpend.toFixed(0)}</span>
        <span className="text-[11px] text-muted-foreground">total</span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{itemCount} item{itemCount !== 1 ? "s" : ""} · ~${avgPrice.toFixed(0)} avg</span>
        {lastPurchaseLabel && <span>{lastPurchaseLabel}</span>}
      </div>

      {monthlySpend.length >= 2 && (
        <Sparkline data={monthlySpend.map((m) => m.amount)} width={120} height={24} className="mt-1" />
      )}
    </div>
  )
}
