"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { MonthComparison } from "@/lib/store"

interface Props {
  data: MonthComparison[]
}

function formatValue(metric: string, value: number): string {
  if (metric === "Items") return String(Math.round(value))
  return `$${value.toFixed(2)}`
}

export function MonthComparisonCard({ data }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {data.map((item) => {
        const isUp = item.change > 0
        const isFlat = item.change === 0
        return (
          <div key={item.metric} className="rounded-lg border bg-card p-3 space-y-1">
            <p className="text-[11px] text-muted-foreground">{item.metric}</p>
            <p className="text-[18px] font-bold text-foreground">{formatValue(item.metric, item.thisMonth)}</p>
            <div className="flex items-center gap-1">
              {isFlat ? (
                <Minus className="size-3 text-muted-foreground" />
              ) : isUp ? (
                <TrendingUp className="size-3 text-chart-4" />
              ) : (
                <TrendingDown className="size-3 text-chart-2" />
              )}
              <span className={`text-[11px] font-medium ${isFlat ? "text-muted-foreground" : isUp ? "text-chart-4" : "text-chart-2"}`}>
                {isFlat ? "No change" : `${Math.abs(item.change).toFixed(0)}%`}
              </span>
              <span className="text-[10px] text-muted-foreground">vs last month</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Last month: {formatValue(item.metric, item.lastMonth)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
