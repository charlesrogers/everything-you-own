"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { CategorySpending } from "@/lib/store"

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

interface Props {
  data: CategorySpending[]
}

export function CategoryBreakdownChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-8 text-center">No spending data yet</p>
  }

  const formatted = data.map((d) => ({
    name: d.category.name,
    amount: Math.round(d.totalSpend * 100) / 100,
    count: d.itemCount,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, formatted.length * 36)}>
      <BarChart data={formatted} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={120} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, props: any) => [
            `$${Number(value).toFixed(2)} (${props?.payload?.count ?? 0} items)`,
            "Spending",
          ]}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
