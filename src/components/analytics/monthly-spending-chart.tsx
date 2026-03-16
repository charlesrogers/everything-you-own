"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { MonthlySpending } from "@/lib/store"

interface Props {
  data: MonthlySpending[]
}

export function MonthlySpendingChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-8 text-center">No spending data yet</p>
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Spending"]}
          labelFormatter={(label) => label}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#spendGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
